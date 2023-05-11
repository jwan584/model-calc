// Define a variable to store the current scroll position
let scrollPosition = 0;


document.addEventListener("keydown", event => {
  if (event.keyCode === 13) { // 13 is the key code for the enter key
    document.getElementById("calculate").click();
  }
});


const mode_output_h2 = document.getElementById("output-mode-h2");
const modeSelector = document.getElementById("mode-selector");

modeSelector.addEventListener("change", () => {
  if (modeSelector.value === "chinchilla-to-llama") {
    document.getElementById("h1_name").innerText = "🐭Chinchilla2Llama🦙";
    const checkbox = document.getElementById("is_chinchilla")
    const parameters = document.getElementById("parameters");
    const tokens = document.getElementById("trainingTokens");
    checkbox.checked = true;
    parameters.value = ""
    tokens.value = ""
    mode_output_h2.textContent = "Make it a Llama Style Model";
    document.querySelectorAll(".chinchilla-to-llama").forEach(element => element.style.display = "inline-block");
    document.getElementById("results").innerHTML = "";
    document.getElementById('myChart').style.display = 'none';
  } else if (modeSelector.value === "llama-to-chinchilla") {
    document.getElementById("h1_name").innerText = "🦙Llama2Chinchilla🐭";
    const parameters = document.getElementById("parameters");
    const tokens = document.getElementById("trainingTokens");
    parameters.value = ""
    tokens.value = ""
    mode_output_h2.textContent = "Make it a Chinchilla Style Model";
    document.querySelectorAll(".chinchilla-to-llama").forEach(element => element.style.display = "none");
    document.getElementById("results").innerHTML = "";
    document.getElementById('myChart').style.display = 'none';
  }

});


// Auto fill chinchilla values
document.getElementById("parameters").addEventListener("input", () => {

  if (modeSelector.value === "chinchilla-to-llama") {
    console.log("chinchilla-to-llama")
    const checkbox = document.getElementById("is_chinchilla").checked;
    const parameters = document.getElementById("parameters");
    const suggestedTokens = document.getElementById("trainingTokens")
    const suggestedParams = document.getElementById("compactModelParameters")
    suggestedParams.value = parameters.value / 2;
    if (checkbox) suggestedTokens.value = parameters.value * 20;
  }
  
  else if (modeSelector.value === "llama-to-chinchilla") {
    console.log("lam to chin")
    const parameters = document.getElementById("parameters");
    const suggestedTokens = document.getElementById("trainingTokens")
    suggestedTokens.value = parameters.value * 100;
  }



});

// Auto fill chinchilla values when re-checked
document.getElementById("is_chinchilla").addEventListener("input", () => {
  const checkbox = document.getElementById("is_chinchilla").checked;
  const parameters = document.getElementById("parameters").value;
  
  if (checkbox) document.getElementById("trainingTokens").value = parameters * 20
});

// Disable chinchilla values
document.getElementById("trainingTokens").addEventListener("input", () => {
  const checkbox = document.getElementById("is_chinchilla");
  checkbox.checked = false;
});

document.getElementById("calculate").addEventListener("click", async () => {
    const parameters = document.getElementById("parameters").value;
    const trainingTokens = document.getElementById("trainingTokens").value;
    const compactModelParameters = document.getElementById("compactModelParameters").value;
    const inferences = document.getElementById("inferences").value;
    const mode = modeSelector.value


    // Get the current scroll position
    scrollPosition = window.scrollY;

    const response = await fetch("/api/calculate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({mode, parameters, trainingTokens, compactModelParameters, inferences})
    });

    const data = await response.json(); 


    // JS => HTML Content
    let outputModelHTML = `
        <h2>Input Model</h2>
        <ul>
          <li><strong>🎯 Estimated Loss: </strong>${data.input_model.loss}</li>
          <li><strong>🧠 Training Flops: </strong> <span id="compute">${data.input_model.compute.toExponential(2)}</span></li>
          <li><strong>⿹ Parameters:</strong> <span id="new_tokens">${parameters} billion</span></li>
          <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${trainingTokens} billion</span></li>
        </ul>
        <div id="estimates"></div>`

    // Return error if no model is found and stop rendering 
    if (!data.output_model.found) {
      outputModelHTML += `<h2>No Models Found 🫤</h2>`
      document.getElementById("results").innerHTML = outputModelHTML;
      return;
    }

    if (mode === "chinchilla-to-llama") {

      outputModelHTML += `
        <h2>Output Model</h2>
        <div id="newModel"></div>
        <ul>
        <li><strong>🎯 Estimated Loss:</strong> <span id="new_estimated-loss">${data.output_model.loss}</span></li>`

        if (data.output_model.found) outputModelHTML += 
          `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute.toExponential(2)}</span></li>`
        else outputModelHTML += 
          `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute}</span></li>`

        outputModelHTML += `
          <li><strong>⿹ Parameters:</strong> <span id="new_tokens">${compactModelParameters} billion</span></li>
          <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${data.output_model.tokens} billion</span></li>
        </ul>`

        let model_size_change = Math.round((compactModelParameters - parameters) * 100 / parameters);
        model_size_change = model_size_change >= 0 ? `+${model_size_change}` : `${model_size_change}`;

        let flops_change = Math.round((data.output_model.compute - data.input_model.compute) * 100 / data.input_model.compute)
        flops_change = flops_change >= 0 ? `+${flops_change}` : `${flops_change}`;

        let tokens_change = Math.round((data.output_model.tokens - trainingTokens) * 100 / trainingTokens)
        tokens_change = tokens_change >= 0 ? `+${tokens_change}` : `${tokens_change}`;

        outputModelHTML += `
        <h2>Comparison</h2>
          <ul>
            <li><strong>🧠 Training FLOPs :</strong> <span id="otc">${flops_change}%</span></li>
            <li><strong>⿹ Parameters: </strong> <span id="otc">${model_size_change}%</span></li>
            <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${tokens_change}%</span></li>
            <li><strong>⚖️ Inference Breakeven:</strong> <span id="inf_breakeven">${data.output_model.inf_breakeven} billion tokens</span></li>
          </ul>`;
      }


    else if (mode === "llama-to-chinchilla") {
      outputModelHTML += 
        `<h2>Output Model</h2>
        <div id="newModel"></div>
        <ul>
        <li><strong>🎯 Estimated Loss:</strong> <span id="new_estimated-loss">${data.output_model.loss}</span></li>`

        if (data.output_model.found) outputModelHTML += 
          `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute.toExponential(2)}</span></li>`
        else outputModelHTML += 
          `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute}</span></li>`

        outputModelHTML += `
          <li><strong>⿹ Parameters:</strong> <span id="new_tokens">${data.output_model.parameters} billion</span></li>
          <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${data.output_model.tokens} billion</span></li>
        </ul>`

        let model_size_change = Math.round((data.output_model.parameters - parameters) * 100 / parameters);
        model_size_change = model_size_change >= 0 ? `+${model_size_change}` : `${model_size_change}`;

        let flops_change = Math.round((data.output_model.compute - data.input_model.compute) * 100 / data.input_model.compute)
        flops_change = flops_change >= 0 ? `+${flops_change}` : `${flops_change}`;

        let tokens_change = Math.round((data.output_model.tokens - trainingTokens) * 100 / trainingTokens)
        tokens_change = tokens_change >= 0 ? `+${tokens_change}` : `${tokens_change}`;

        outputModelHTML += `
        <h2>Comparison</h2>
          <ul>
            <li><strong>🧠 Training FLOPs :</strong> <span id="otc">${flops_change}%</span></li>
            <li><strong>⿹ Parameters: </strong> <span id="otc">${model_size_change}%</span></li>
            <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${tokens_change}%</span></li>
            <li><strong>⚖️ Inference Breakeven:</strong> <span id="inf_breakeven">${data.output_model.inf_breakeven} billion tokens</span></li>
          </ul>`;
      }

      // Push HTML to results div
      document.getElementById("results").innerHTML = outputModelHTML;

      const inputTrainingFlops = data.input_model.compute;
      const outputTrainingFlops = data.output_model.compute;
      const inputInfFlops = data.input_model.original_inf_cost;
      const outputInfFlops = data.output_model.output_inf_cost;

      drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops); 
      document.getElementById('myChart').style.display = 'block';


});


function drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops) {
        // Get the canvas element
      const canvas = document.getElementById('myChart');

      // Destroy the existing chart object (if it exists)
      if (window.chart) {
        window.chart.destroy();
      }

      // Create the new chart object
      window.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Input Model', 'Output Model'],
          datasets: [
            {
              label: 'Training FLOPS',
              data: [inputTrainingFlops, outputTrainingFlops],
              backgroundColor: ['#0077be', '#0077be'],
              stack: 'Stack 1'
            },
            {
              label: 'Inference FLOPs',
              data: [inputInfFlops, outputInfFlops],
              backgroundColor: ['#4CAF50', '#4CAF50'],
              stack: 'Stack 1'
            }
          ]
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom'
            }
          },
          scales: {
            x: {
              stacked: true,
              title: {
                display: true,
                font: {
                  size: 24,
                  family: 'Rubik',
                  weight: '500',
                  color: '#000'
                }
              },
              ticks: {
                font: {
                  size: 14,
                  family: 'Rubik',
                  weight: '500',
                  color: '#000'
                }
              }
            },
            y: {
              stacked: true,
              title: {
                display: true,
                text: 'FLOPS',
                font: {
                  size: 14,
                  family: 'Rubik',
                  weight: '500',
                  color: '#000'
                }
              },
              ticks: {
                beginAtZero: true,
                font: {
                  size: 14,
                  family: 'Rubik',
                  weight: '500',
                  color: '#000'
                }
              }
            }
          }
        }
      });
      window.scrollTo(0, scrollPosition);
}