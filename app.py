import math
import numpy as np
from flask import Flask, render_template, request, jsonify

def loss(p, t):
    l = (1 + 0.023 * math.log(math.sqrt(20 / (t / p))) ** 2) * (((6 * t * p) / 5.984E+22) ** -0.0737 + 0.5066)
    return(round(l,5))

def flops(p, t):
    return 6 * p * t

def training_cost(f):       
    Cost_per_h = 40.96       #AWS 8xA100 on demand
    Cost_per_sec = Cost_per_h / (60 * 60)
    HW_Flops = 8*312e12     # 8 GPU x 321 Tflops
    Util = 0.35             # 35% util 
    Model_Flops = HW_Flops * Util
    Cost_per_flop = Cost_per_sec / Model_Flops
    return round((Cost_per_flop * f), 1)


def compact_model(p, t, new_p):
    og_loss = loss(p, t)
    print("og_loss = ", og_loss)

    # Define the lower and upper bounds of the token range
    lower_bound = new_p         # lower bound is 1 token per param
    upper_bound = 1e18          # really high upper bound in case P is high

    # Loss function has a divergent tail. Prune the tail iteratively by 10x at a time
    upper_loss = loss(new_p, upper_bound) 
    upper_bound_new = upper_bound * 0.1
    upper_loss_new = loss (new_p, upper_bound_new)
    while (upper_loss_new < upper_loss):
        upper_bound = upper_bound_new
        upper_bound_new *= 0.1 
        upper_loss = loss(new_p, upper_bound) 
        upper_loss_new = loss (new_p, upper_bound_new)
        print(f"upper t = {upper_bound:.3e}, loss = {upper_loss}, lower t = {upper_bound_new:.3e}, loss = {upper_loss_new}")
        t_values = np.linspace(lower_bound, upper_bound, 1000)
        loss_values = [loss(p, t) for t in t_values]
    
    # Perform binary search over monotonic pruned range
    tolerance = 0.0001
    new_t = (lower_bound + upper_bound) / 2
    while abs(loss(new_p, new_t) - og_loss) > tolerance:
        if lower_bound == upper_bound:
            print('no model found')
            return None
        if loss(new_p, new_t) < og_loss:
            upper_bound = new_t
        else:
            lower_bound = new_t
        new_t = (lower_bound + upper_bound) / 2
        print(f"lower_bound: {lower_bound:.3e}, upper_bound: {upper_bound:.3}, new_t: {new_t:.3e}, loss(new_p, new_t): {loss(new_p, new_t)}")

    return new_t


def chinchilla_model (input_loss): 
    input_flops = ((input_loss - 0.5066)**(1/-0.0737)) * 5.984e22    # Cerebras-GPT equation 1 rebalanced
    print("flops = " , input_flops)
    p = math.sqrt(input_flops/120)                               # F = 6 * f * p, T = 20 * p
    t = p * 20
    l = loss (p,t)
    print("L = ", l)
    return p, t


# Web App

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/calculate", methods=["POST"])
def calculate():

    data = request.get_json()
    mode = data.get("mode")
    parameters = float(data["parameters"]) * 1e9
    training_tokens = float(data["trainingTokens"]) * 1e9
   
    # error handling for optional Inferences field
    inferences = data.get("inferences")
    if inferences is None or inferences == "":
        inferences = 0
    else:
        inferences = float(inferences) * 1e9  # convert from millions

    original_loss = loss(parameters, training_tokens)
    original_flops = flops(parameters, training_tokens)
    original_cost = training_cost(original_flops)
    original_inf_cost = 2 * parameters * inferences
            
    
    ### Logic Path for chinchilla-to-llama mode ###

    if (mode == "chinchilla-to-llama"):

        print('llmama mode');

        compact_model_parameters = float(data["compactModelParameters"]) * 1e9

        compact_model_tokens = compact_model(parameters, training_tokens, compact_model_parameters)

        model_found = True
        if compact_model_tokens is None:
            model_found = False
            input_model = { "loss": original_loss,
                            "compute": original_flops,
                            "original_inf_cost":original_inf_cost,
                            "cost": original_cost}
            output_model = {"found":model_found}
            return jsonify({"input_model": input_model, "output_model": output_model})


        compact_model_tokens_str = int(compact_model_tokens/1e9)
        compact_model_loss = loss(compact_model_parameters, compact_model_tokens)
        compact_model_flops = flops(compact_model_parameters, compact_model_tokens)

        compact_model_cost = training_cost(compact_model_flops)

        over_training_cost = (compact_model_flops / original_flops - 1) * 100
        over_training_cost = f"{over_training_cost:.1f}%"

        # Num of tokens needed to breakeven in total training + inf cost
        if parameters == compact_model_parameters:
            inf_breakeven_tokens = 0
            inf_breakeven_tokens_str = 0
        else:    
            inf_breakeven_tokens = (compact_model_flops - original_flops) / (2 * (parameters - compact_model_parameters))
            inf_breakeven_tokens_str = (round(inf_breakeven_tokens/1e9,0))

        dau = int(inf_breakeven_tokens / (1000 * 365)) # daily active users, assuming 1000 tokens per day


        output_inf_cost = 2 * compact_model_parameters * inferences

        input_model = { "loss": original_loss,
                        "compute": original_flops,
                        "original_inf_cost":original_inf_cost,
                        "cost": original_cost}
        output_model = {"found":model_found,
                        "loss": compact_model_loss, 
                        "tokens": compact_model_tokens_str,
                        "compute": compact_model_flops,
                        "cost": compact_model_cost,
                        "otc":over_training_cost,
                        "output_inf_cost":output_inf_cost,
                        "inf_breakeven":inf_breakeven_tokens_str,
                        "dau": dau}
        return jsonify({"input_model": input_model, "output_model": output_model})


    ### Logic Path for llama-to-chinchilla mode ### 
    elif (mode == "llama-to-chinchilla"):

        print('chinchilla mode');

        chinchilla_params, chinchilla_tokens = chinchilla_model(original_loss)
        chinchilla_tokens_str = int(chinchilla_tokens/1e9)
        chinchilla_params_str = str(round(chinchilla_params/1e9, 0))
        chinchilla_loss = loss(chinchilla_params, chinchilla_tokens)
        chinchilla_flops = flops (chinchilla_params, chinchilla_tokens)
        flops_decrease = ((original_flops - chinchilla_flops) / original_flops) * 100 
        flops_decrease = f"{flops_decrease:.1f}%"
        chinchilla_training_cost = training_cost(chinchilla_flops)
        chinchilla_inf_cost = 2 * chinchilla_params * inferences

        if parameters == chinchilla_params:
            inf_breakeven_tokens = 0
            inf_breakeven_tokens_str = 0
        else:    
            inf_breakeven_tokens = (original_flops - chinchilla_flops) / (2 * (chinchilla_params - parameters))
            inf_breakeven_tokens_str = int(inf_breakeven_tokens/1e9)

        dau = int(inf_breakeven_tokens / (1000 * 365)) # daily active users, assuming 1000 tokens per day
      
        model_found = True

        input_model = { "loss": original_loss,
                        "compute": original_flops,
                        "original_inf_cost":original_inf_cost,
                        "cost": original_cost}
        output_model = {"found":model_found,
                        "loss": chinchilla_loss, 
                        "parameters": chinchilla_params_str,
                        "tokens": chinchilla_tokens_str,
                        "compute": chinchilla_flops,
                        "cost": chinchilla_training_cost,
                        "otc":flops_decrease,
                        "output_inf_cost":chinchilla_inf_cost,
                        "inf_breakeven":inf_breakeven_tokens_str,
                        "dau": dau}
        return jsonify({"input_model": input_model, "output_model": output_model})


if __name__ == "__main__":
    app.run(port=8080)











