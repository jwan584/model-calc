// Define a variable to store the current scroll position
let scrollPosition = 0;
const mode = document.getElementById("mode");
const total_compute_cost = document.getElementById("total_compute_cost");
total_compute_cost.style.display = "none"

$(document).ready(function() {
    $("#model1_list").change(function() {
        var selectedValue = $(this).val();

        // Find the selected model in the models list
        var selectedModel = models.find(function(item) {
            return item.name === selectedValue;
        });

        // Update the input fields with the parameters and token numbers
        if (selectedModel) {
            $("#params1").val(selectedModel.params);
            $("#tokens1").val(selectedModel.tokens);
        } else {
            $("#params1").val("");
            $("#tokens1").val("");
        }
    });

    $("#model2_list").change(function() {
        var selectedValue = $(this).val();

        // Find the selected model in the models list
        var selectedModel = models.find(function(item) {
            return item.name === selectedValue;
        });

        // Update the input fields with the parameters and token numbers
        if (selectedModel) {
            $("#params2").val(selectedModel.params);
            $("#tokens2").val(selectedModel.tokens);
        } else {
            $("#params2").val("");
            $("#tokens2").val("");
        }
    });

});



mode.addEventListener("change", function () {
  const tokens2 = document.getElementById("tokens2");
  if (mode.value === "iso_loss") {
    tokens2.value = "🧙✨";
    tokens2.disabled = true;
  } else {
    tokens2.disabled = false;
  }
});



document.addEventListener("keydown", event => {
  if (event.keyCode === 13) { // 13 is the key code for the enter key
    document.getElementById("calculate").click();
  }
});

document.getElementById("calculate").addEventListener("click", async () => {
  const params1 = document.getElementById("params1").value;
  const params2 = document.getElementById("params2").value;
  const tokens1 = document.getElementById("tokens1").value;
  var tokens2 = document.getElementById("tokens2").value;
  const inf1 = document.getElementById("inf1").value || 0;
  const inf2 = document.getElementById("inf2").value || 0;
  const mode_val = mode.value;
 
  console.log(params1)
  console.log(mode.value)

  // Get the current scroll position
  scrollPosition = window.scrollY;

  const response = await fetch("/api/calculate", {
      method: "POST",
      headers: {
          "Content-Type": "application/json"
      },
      body: JSON.stringify({params1, params2, tokens1, tokens2, inf1, inf2, mode_val})
  });

  const data = await response.json(); 


  console.log(mode.value)
  if (mode.value === "iso_loss")
    tokens2 = data.tokens2;

  const model1_loss = data.model1_loss
  const model2_loss = data.model2_loss
  const model1_flops = data.model1_flops.toExponential(2)
  const model2_flops = data.model2_flops.toExponential(2)
  const model1_inf_flops = data.model1_inf_flops.toExponential(2)
  const model2_inf_flops = data.model2_inf_flops.toExponential(2)
  const inf_breakeven_tokens = Math.abs(data.inf_breakeven_tokens)

  const memory1 = params1 * 1.2
  const memory2 = params2 * 1.2

  let params_change = ((params2 - params1) / params1 * 100).toFixed(1)
  let tokens_change = ((tokens2 - tokens1) / tokens1 * 100).toFixed(1)
  let loss_change = ((model2_loss - model1_loss) / model1_loss * 100).toFixed(1)
  let flops_change = ((model2_flops - model1_flops) / model1_flops * 100).toFixed(1)
  let memory_change = ((memory2 - memory1) / memory1 * 100).toFixed(1)

  params_change = params_change > 0 ? `+${params_change}` : `${params_change}`;
  tokens_change = tokens_change > 0 ? `+${tokens_change}` : `${tokens_change}`;
  loss_change = loss_change > 0 ? `+${loss_change}` : `${loss_change}`;
  flops_change = flops_change > 0 ? `+${flops_change}` : `${flops_change}`;
  memory_change = memory_change > 0 ? `+${memory_change}` : `${memory_change}`;

  let explainer = ""; 

  let outputModelHTML = '';

  console.log(inf_breakeven_tokens)


  if (mode.value === "iso_loss")
    explainer = "To achieve the same loss as Model 1, Model 2 with " + params2 + "B parameters would need to be trained with " + tokens2 + "B tokens.";

  if (inf_breakeven_tokens != "0")
    explainer += "Model 1 and Model 2 achieve total compute breakeven after " + inf_breakeven_tokens + " billion inference tokens."


  // JS => HTML Content

   outputModelHTML = `
      <h2>Results</h2>
      <p>${explainer}</p>
      <table id="output_table">
          <thead>
              <tr>
                  <th></th>
                  <th>Model 1</th>
                  <th>Model 2</th>
                  <th>Comparison</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td><strong>🎯 Estimated Loss</strong></td>
                  <td>${model1_loss}</td>
                  <td>${model2_loss}</td>
                  <td>${loss_change}%</td>
              </tr>
              <tr>
                  <td><strong>🧠 Training Flops</strong></td>
                  <td><span>${model1_flops}</span></td>
                  <td><span>${model2_flops}</span></td>
                  <td><span>${flops_change}%</span></td>
              </tr>
              <tr>
                  <td><strong>⿹ Parameters</strong></td>
                  <td><span>${params1} billion</span></td>
                  <td><span>${params2} billion</span></td>
                  <td><span>${params_change}%</span></td>
              </tr>
              <tr>
                  <td><strong>📖 Training Tokens</strong></td>
                  <td><span>${tokens1} billion</span></td>
                  <td><span>${tokens2} billion</span></td>
                  <td><span id="new_tokens">${tokens_change}%</span></td>
              </tr>
              <tr>
                  <td><strong>💾 Memory Req for Inference (INT8)</strong></td>
                  <td>${memory1} GB</td>
                  <td>${memory2} GB</td>
                  <td>${memory_change}%</td>
              </tr>
          </tbody>
      </table>`; 

    // Push HTML to results div
    document.getElementById("results").innerHTML = outputModelHTML;

    // Draw Chart
    const inputTrainingFlops = model1_flops
    const outputTrainingFlops = model2_flops
    const inputInfFlops = model1_inf_flops
    const outputInfFlops = model2_inf_flops

    drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops); 
    document.getElementById('myChart').style.display = 'block';

});




  // let model_size_change = Math.round((compactModelParameters - parameters) * 100 / parameters);
  //   model_size_change = model_size_change >= 0 ? `+${model_size_change}` : `${model_size_change}`;

  // let flops_change = Math.round((data.output_model.compute - data.input_model.compute) * 100 / data.input_model.compute)
  // flops_change = flops_change >= 0 ? `+${flops_change}` : `${flops_change}`;

  // let tokens_change = Math.round((data.output_model.tokens - trainingTokens) * 100 / trainingTokens)
  // tokens_change = tokens_change >= 0 ? `+${tokens_change}` : `${tokens_change}`;


    // Return error if no model is found and stop rendering 
    // if (!data.output_model.found) {
    //   outputModelHTML += `<h2>No Models Found 🫤</h2>`
    //   document.getElementById("results").innerHTML = outputModelHTML;
    //   document.getElementById('myChart').style.display = 'none';
    //   return;
    // }

    // if (mode === "chinchilla-to-llama") {

    //   outputModelHTML += `
    //     <h2>Output Model</h2>
    //     <ul>
    //     <li><strong>🎯 Estimated Loss:</strong> <span id="new_estimated-loss">${data.output_model.loss}</span></li>`

    //     if (data.output_model.found) outputModelHTML += 
    //       `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute.toExponential(2)}</span></li>`
    //     else outputModelHTML += 
    //       `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute}</span></li>`

    //     outputModelHTML += `
    //       <li><strong>⿹ Parameters:</strong> <span id="new_tokens">${compactModelParameters} billion</span></li>
    //       <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${data.output_model.tokens} billion</span></li>
    //     </ul>`

    //     let model_size_change = Math.round((compactModelParameters - parameters) * 100 / parameters);
    //     model_size_change = model_size_change >= 0 ? `+${model_size_change}` : `${model_size_change}`;

    //     let flops_change = Math.round((data.output_model.compute - data.input_model.compute) * 100 / data.input_model.compute)
    //     flops_change = flops_change >= 0 ? `+${flops_change}` : `${flops_change}`;

    //     let tokens_change = Math.round((data.output_model.tokens - trainingTokens) * 100 / trainingTokens)
    //     tokens_change = tokens_change >= 0 ? `+${tokens_change}` : `${tokens_change}`;

    //     outputModelHTML += `
    //     <h2>Comparison</h2>
    //       <ul>
    //         <li><strong>🧠 Training FLOPs :</strong> <span id="otc">${flops_change}%</span></li>
    //         <li><strong>⿹ Parameters: </strong> <span id="otc">${model_size_change}%</span></li>
    //         <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${tokens_change}%</span></li>
    //         <li><strong>⚖️ Inferences to Breakeven:</strong> <span id="inf_breakeven">${data.output_model.inf_breakeven} billion tokens 
    //         <li><strong>👥 Users to Breakeven:</strong> <span id="inf_breakeven">${(data.output_model.dau).toLocaleString()} daily active users
    //       </ul>`;
    //   }


    // else if (mode === "llama-to-chinchilla") {
    //   outputModelHTML += 
    //     `<h2>Output Model</h2>
    //     <ul>
    //     <li><strong>🎯 Estimated Loss:</strong> <span id="new_estimated-loss">${data.output_model.loss}</span></li>`

    //     if (data.output_model.found) outputModelHTML += 
    //       `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute.toExponential(2)}</span></li>`
    //     else outputModelHTML += 
    //       `<li><strong>🧠 Training Flops:</strong> <span id="new_compute">${data.output_model.compute}</span></li>`

    //     outputModelHTML += `
    //       <li><strong>⿹ Parameters:</strong> <span id="new_tokens">${data.output_model.parameters} billion</span></li>
    //       <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${data.output_model.tokens} billion</span></li>
    //     </ul>`

    //     let model_size_change = Math.round((data.output_model.parameters - parameters) * 100 / parameters);
    //     model_size_change = model_size_change >= 0 ? `+${model_size_change}` : `${model_size_change}`;

    //     let flops_change = Math.round((data.output_model.compute - data.input_model.compute) * 100 / data.input_model.compute)
    //     flops_change = flops_change >= 0 ? `+${flops_change}` : `${flops_change}`;

    //     let tokens_change = Math.round((data.output_model.tokens - trainingTokens) * 100 / trainingTokens)
    //     tokens_change = tokens_change >= 0 ? `+${tokens_change}` : `${tokens_change}`;

    //     outputModelHTML += `
    //     <h2>Comparison</h2>
    //       <ul>
    //         <li><strong>🧠 Training FLOPs :</strong> <span id="otc">${flops_change}%</span></li>
    //         <li><strong>⿹ Parameters: </strong> <span id="otc">${model_size_change}%</span></li>
    //         <li><strong>📖 Training Tokens:</strong> <span id="new_tokens">${tokens_change}%</span></li>
    //         <li><strong>⚖️ Inference Breakeven:</strong> <span id="inf_breakeven">${data.output_model.inf_breakeven} billion tokens</span></li>
    //         <li><strong>👥 Users to Breakeven:</strong> <span id="inf_breakeven">${(data.output_model.dau).toLocaleString()} daily active users
    //       </ul>`;
    //   }



      // const inputTrainingFlops = data.input_model.compute;
      // const outputTrainingFlops = data.output_model.compute;
      // const inputInfFlops = data.input_model.original_inf_cost;
      // const outputInfFlops = data.output_model.output_inf_cost;

      // drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops); 
      // document.getElementById('myChart').style.display = 'block';



function drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops) {
        // Get the canvas element
      const canvas = document.getElementById('myChart');
      total_compute_cost.style.display = "block"

      // Destroy the existing chart object (if it exists)
      if (window.chart) {
        window.chart.destroy();
      }

      // Create the new chart object
      window.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Model 1', 'Model 2'],
          datasets: [
            {
              label: 'Training FLOPS',
              data: [inputTrainingFlops, outputTrainingFlops],
              backgroundColor: ['#0077be', '#0077be'],
              stack: 'Stack 1',
              barThickness: 200
            },
            {
              label: 'Inference FLOPs',
              data: [inputInfFlops, outputInfFlops],
              backgroundColor: ['#4CAF50', '#4CAF50'],
              stack: 'Stack 1',
              barThickness: 200
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
                  size: 16,
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
                  size: 16,
                  family: 'Rubik',
                  weight: '500',
                  color: '#000'
                }
              },
              ticks: {
                beginAtZero: true,
                font: {
                  size: 16,
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



// Get modal element
const modal = document.getElementById('modal');

// Get open modal button
const openModalButton = document.getElementById('about-link');

// Get close button
const closeButton = document.querySelector('.close');

// Listen for open click
openModalButton.addEventListener('click', openModal);

// Listen for close click
closeButton.addEventListener('click', closeModal);

// Listen for outside click
window.addEventListener('click', outsideClick);

// Function to open modal
function openModal(e) {
    e.preventDefault();
    modal.classList.add('show');
}

// Function to close modal
function closeModal() {
    modal.classList.remove('show');
}

// Function to close modal if outside click
function outsideClick(e) {
    if (e.target == modal) {
        closeModal();
    }
}
