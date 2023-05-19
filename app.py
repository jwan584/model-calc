import math, csv, os
import numpy as np
from flask import Flask, render_template, request, jsonify

def loss(p, t):
    l = (1 + 0.023 * math.log(math.sqrt(20 / (t / p))) ** 2) * (((6 * t * p) / 5.984E+22) ** -0.0737 + 0.5066)
    return(round(l,4))

def flops(p, t):
    return 6 * p * t

def calc_loss_series(p, t):
    tokens = np.linspace(1e9, t, 100)
    loss_series = [(int(token/1e9), loss(p, token)) for token in tokens]
    return loss_series

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
    # print("og_loss = ", og_loss)

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
        # print(f"upper t = {upper_bound:.3e}, loss = {upper_loss}, lower t = {upper_bound_new:.3e}, loss = {upper_loss_new}")
        t_values = np.linspace(lower_bound, upper_bound, 1000)
        loss_values = [loss(p, t) for t in t_values]
    
    # Perform binary search over monotonic pruned range
    tolerance = 0.00001
    new_t = (lower_bound + upper_bound) / 2
    while abs(loss(new_p, new_t) - og_loss) > tolerance:
        if lower_bound == upper_bound:
            # print('no model found')
            return None
        if loss(new_p, new_t) < og_loss:
            upper_bound = new_t
        else:
            lower_bound = new_t
        new_t = (lower_bound + upper_bound) / 2
        # print(f"lower_bound: {lower_bound:.3e}, upper_bound: {upper_bound:.3}, new_t: {new_t:.3e}, loss(new_p, new_t): {loss(new_p, new_t)}")

    return new_t



# Web App

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():

     # Path to the script & CSV
    script_dir = os.path.dirname(__file__)
    models_file_path = os.path.join(script_dir, 'models.csv')

    models = []
    with open(models_file_path, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            models.append(row)

    # Pass the models into the template
    return render_template('index.html', models=models)



@app.route("/api/calculate", methods=["POST"])
def calculate():
    data = request.get_json()

    # parse JSON values:
    mode = data.get("mode_val")
    print(mode)

    ### Compare Mode ###
    if (mode == "compare"):
        params1 = float(data["params1"]) * 1e9
        params2 = float(data["params2"]) * 1e9
        tokens1 = float(data["tokens1"]) * 1e9
        tokens2 = float(data["tokens2"]) * 1e9
        inf1 = float(data["inf1"]) * 1e9
        inf2 = float(data["inf2"]) * 1e9
        loss_series1 = calc_loss_series(params1, tokens1)
        loss_series2 = calc_loss_series(params2, tokens2)

        model1_loss = loss(params1, tokens1)
        model2_loss = loss(params2, tokens2)
        model1_flops = flops(params1, tokens1)
        model2_flops = flops(params2, tokens2)
        model1_inf_flops = 2 * params1 * inf1 
        model2_inf_flops = 2 * params2 * inf2 

        model_found = True;
        
        # Num of tokens needed to breakeven in total training + inf cost
        if params1 == params2:
            inf_breakeven_tokens = 0
            inf_breakeven_tokens_str = 0
        else:    
            inf_breakeven_tokens = (model2_flops - model1_flops) / (2 * (params1 - params2))
            inf_breakeven_tokens_str = (round(inf_breakeven_tokens/1e9,0))

        response = {
            "found":model_found,
            "model1_loss": model1_loss,
            "model2_loss": model2_loss,
            "model1_flops": model1_flops,
            "model2_flops": model2_flops,
            "model1_inf_flops": model1_inf_flops,
            "model2_inf_flops": model2_inf_flops,
            "loss_series1": loss_series1,
            "loss_series2": loss_series2,
            "inf_breakeven_tokens": inf_breakeven_tokens_str
        }
        
        return jsonify(response)


    ### ISO Loss Mode ###
    elif (mode == "iso_loss"): 
        params1 = float(data["params1"]) * 1e9
        params2 = float(data["params2"]) * 1e9
        tokens1 = float(data["tokens1"]) * 1e9
        inf1 = float(data["inf1"]) * 1e9
        inf2 = float(data["inf2"]) * 1e9

        model1_loss = loss(params1, tokens1)
        model1_flops = flops(params1, tokens1)
        model1_inf_flops = 2 * params1 * inf1 
        
        tokens2 = compact_model(params1, tokens1, params2)
       
        # handle model not found case
        model_found = True
        if tokens2 is None:
            model_found = False
            response = {"found":model_found,
                        "model1_loss": model1_loss,
                        "model1_flops": model1_flops,
                        "model1_inf_flops":model1_inf_flops}
            return jsonify(response)

        # continue if model is found
        model2_loss = loss(params2, tokens2)
        model2_flops = flops(params2, tokens2)
        model2_inf_flops = 2 * params2 * inf2 

        loss_series1 = calc_loss_series(params1, tokens1)
        loss_series2 = calc_loss_series(params2, tokens2)

        tokens2_str = int(tokens2/1e9)

        # Num of tokens needed to breakeven in total training + inf cost
        if params1 == params2:
            inf_breakeven_tokens = 0
            inf_breakeven_tokens_str = 0
        else:    
            inf_breakeven_tokens = (model2_flops - model1_flops) / (2 * (params1 - params2))
            inf_breakeven_tokens_str = (round(inf_breakeven_tokens/1e9,0))

        response = {
            "found":model_found,
            "tokens2": tokens2_str,
            "model1_loss": model1_loss,
            "model2_loss": model2_loss,
            "model1_flops": model1_flops,
            "model2_flops": model2_flops,
            "model1_inf_flops": model1_inf_flops,
            "model2_inf_flops": model2_inf_flops,
            "loss_series1": loss_series1,
            "loss_series2": loss_series2,
            "inf_breakeven_tokens": inf_breakeven_tokens_str
        }

        return jsonify(response)
        



if __name__ == "__main__":
    app.run(debug=True)

