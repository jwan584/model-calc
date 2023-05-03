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
    token_range = np.arange(0.1e9, 10000e9, 0.1e9)

    for tr in token_range:
        new_loss = loss(new_p, tr)
        if new_loss <= og_loss:
            new_t = tr
            break

    if new_t is None:
        return None

    return new_t


# Web App

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/calculate", methods=["POST"])
def calculate():

    data = request.get_json()
    
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


    compact_model_tokens_str = str(compact_model_tokens/1e9) + " billion"
    compact_model_loss = loss(compact_model_parameters, compact_model_tokens)
    compact_model_flops = flops(compact_model_parameters, compact_model_tokens)

    compact_model_cost = training_cost(compact_model_flops)

    over_training_cost = (compact_model_flops / original_flops - 1) * 100
    over_training_cost = f"{over_training_cost:.1f}%"

    # Num of tokens needed to breakeven in total training + inf cost
    inf_breakeven_tokens = (compact_model_flops - original_flops) / (2 * (parameters - compact_model_parameters))
    inf_breakeven_tokens_str = str(round(inf_breakeven_tokens/1e9, 1)) + " billion tokens"

    compact_inf_cost = 2 * compact_model_parameters * inferences

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
                    "compact_inf_cost":compact_inf_cost,
                    "inf_breakeven":inf_breakeven_tokens_str}

    return jsonify({"input_model": input_model, "output_model": output_model})

if __name__ == "__main__":
    app.run(debug=True)











