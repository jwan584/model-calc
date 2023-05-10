import math
import numpy as np
from flask import Flask, render_template, request, jsonify

def loss(p, t):
    l = (1 + 0.023 * math.log(math.sqrt(20 / (t / p))) ** 2) * (((6 * t * p) / 5.984E+22) ** -0.0737 + 0.5066)
    return(round(l,3))

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
    new_t = None
    og_loss = loss(p, t)
    token_range = np.arange(0.1e9, 30000e9, 0.1e9)

    for tr in token_range:
        new_loss = loss(new_p, tr)
        if new_loss <= og_loss:
            new_t = tr
            break

    if new_t is None:
        print('no model found')
        return None

    return new_t

# def compact_model(p, t, new_p):
#     og_loss = loss(p, t)
#     print(f"OG Loss: {og_loss}")
#     # Define the lower and upper bounds of the token range
#     lower_bound = 0.1e9
#     upper_bound = 1e15
#     # Set an initial guess for the new token value
#     new_t = (lower_bound + upper_bound) / 2
#     # Define a tolerance level for the loss function
#     tolerance = 0.001

#     # Perform binary search over the token range
#     while abs(loss(new_p, new_t) - og_loss) > tolerance:
#         if (lower_bound == upper_bound):
#             return
#         if loss(new_p, new_t) < og_loss:
#             upper_bound = new_t
#         else:
#             lower_bound = new_t
#         new_t = (lower_bound + upper_bound) / 2
#         print(f"lower_bound: {lower_bound}, upper_bound: {upper_bound}, new_t: {new_t}, loss(new_p, new_t): {loss(new_p, new_t)}")

#     return new_t

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


        compact_model_tokens_str = (compact_model_tokens/1e9)
        compact_model_loss = loss(compact_model_parameters, compact_model_tokens)
        compact_model_flops = flops(compact_model_parameters, compact_model_tokens)

        compact_model_cost = training_cost(compact_model_flops)

        over_training_cost = (compact_model_flops / original_flops - 1) * 100
        over_training_cost = f"{over_training_cost:.1f}%"

        # Num of tokens needed to breakeven in total training + inf cost
        inf_breakeven_tokens = (compact_model_flops - original_flops) / (2 * (parameters - compact_model_parameters))
        inf_breakeven_tokens_str = (round(inf_breakeven_tokens/1e9,0))

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
                        "inf_breakeven":inf_breakeven_tokens_str}
        return jsonify({"input_model": input_model, "output_model": output_model})


    ### Logic Path for llama-to-chinchilla mode ### 
    elif (mode == "llama-to-chinchilla"):

        print('chinchilla mode');

        chinchilla_params, chinchilla_tokens = chinchilla_model(original_loss)
        chinchilla_tokens_str = str(round(chinchilla_tokens/1e9, 0))
        chinchilla_params_str = str(round(chinchilla_params/1e9, 0))
        chinchilla_loss = loss(chinchilla_params, chinchilla_tokens)
        chinchilla_flops = flops (chinchilla_params, chinchilla_tokens)
        flops_decrease = ((original_flops - chinchilla_flops) / original_flops) * 100 
        flops_decrease = f"{flops_decrease:.1f}%"
        chinchilla_training_cost = training_cost(chinchilla_flops)
        chinchilla_inf_cost = 2 * chinchilla_params * inferences
        inf_breakeven_tokens = (original_flops - chinchilla_flops) / (2 * (chinchilla_params - parameters))
        inf_breakeven_tokens_str = str(round(inf_breakeven_tokens/1e9, 0))
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
                        "inf_breakeven":inf_breakeven_tokens_str}
        return jsonify({"input_model": input_model, "output_model": output_model})


if __name__ == "__main__":
    app.run(debug=True)











