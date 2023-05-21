// Define a variable to store the current scroll position
let isMobileLayout = false;
let scrollPosition = 0;
const mode = document.getElementById("mode");
const total_compute_cost = document.getElementById("total_compute_cost");
const loss_chart = document.getElementById("loss_chart_div");
const flops_chart = document.getElementById('myChart')
total_compute_cost.style.display = "none"
loss_chart.style.display = "none"

let mobile_multiple_03 = 1;
let mobile_multiple_05 = 1;
let mobile_multiple_07 = 1;

if (window.innerWidth <= 600) {
  isMobileLayout = true;
  mobile_multiple_03 = 0.3;
  mobile_multiple_05 = 0.5;
  mobile_multiple_07 = 0.7;
  console.log('mobile')
}




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
    }).change();

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
    }).change();

    const params1 = document.getElementById("params1");
    const tokens1 = document.getElementById("tokens1");
    const params2 = document.getElementById("params2");
    const tokens2 = document.getElementById("tokens2");
    const model1_list = document.getElementById("model1_list");
    const model2_list = document.getElementById("model2_list");

    // Set model1_list to "Custom" when params1 or tokens1 is edited
    params1.oninput = tokens1.oninput = function() {
        model1_list.value = "Custom";
    }

    // Set model2_list to "Custom" when params2 or tokens2 is edited
    params2.oninput = tokens2.oninput = function() {
        model2_list.value = "Custom";
    }


});


mode.addEventListener("change", function () {
  const tokens2 = document.getElementById("tokens2");
  if (mode.value === "iso_loss") {
    tokens2.value = "🧙✨";
    tokens2.disabled = true;
    model2_list.value = "Custom";
    document.getElementById("params2").value = document.getElementById("params1").value / 2;
  } else {
    tokens2.disabled = false;
    document.getElementById("tokens2").value = "";
  }
});



const inferences1 = document.getElementById("inf1");
const inferences2 = document.getElementById("inf2");

inferences1.addEventListener("blur", function() {
  inferences2.value = inferences1.value;
});

document.addEventListener("keydown", event => {
  if (event.keyCode === 13) { // 13 is the key code for the enter key
    document.getElementById("calculate").click();
  }
});

//  Main Function //

document.getElementById("calculate").addEventListener("click", async () => {

  // Get the current scroll position
  scrollPosition = window.scrollY;

  const params1 = document.getElementById("params1").value;
  const params2 = document.getElementById("params2").value;
  const tokens1 = document.getElementById("tokens1").value;
  var tokens2 = document.getElementById("tokens2").value;
  const inf1 = document.getElementById("inf1").value || 0;
  const inf2 = document.getElementById("inf2").value || 0;
  const mode_val = mode.value;
 

  // Send JSON data
  const response = await fetch("/api/calculate", {
      method: "POST",
      headers: {
          "Content-Type": "application/json"
      },
      body: JSON.stringify({params1, params2, tokens1, tokens2, inf1, inf2, mode_val})
  });

  const data = await response.json(); 

  let outputModelHTML = '';
  let explainer = ""; 

  // Return error if no model is found and stop rendering 
  if (!data.found) {
    outputModelHTML += `<h4>😵 A ${params2} billion parameter model cannot reach the loss of Model 1 with any amount of training data. Increase the model size and try again.</h4>`
    document.getElementById("results").innerHTML = outputModelHTML;
    document.getElementById('myChart').style.display = 'none';
    total_compute_cost.style.display = "none"
    return;
  }

  if (mode.value === "iso_loss")
    tokens2 = data.tokens2;

  // Extract JSON values
  const model1_loss = data.model1_loss
  const model2_loss = data.model2_loss
  const model1_flops = data.model1_flops.toExponential(2)
  const model2_flops = data.model2_flops.toExponential(2)
  const model1_inf_flops = data.model1_inf_flops.toExponential(2)
  const model2_inf_flops = data.model2_inf_flops.toExponential(2)
  const inf_breakeven_tokens = (Math.abs(data.inf_breakeven_tokens)).toLocaleString();
  const memory1 = (params1 * 1.2).toFixed(1)
  const memory2 = (params2 * 1.2).toFixed(1)
  const loss_series1 = data.loss_series1
  const loss_series2 = data.loss_series2

  // Calculate percent values
  let params_change = ((params2 - params1) / params1 * 100).toFixed(1)
  let tokens_change = ((tokens2 - tokens1) / tokens1 * 100).toFixed(1)
  let loss_change = ((model2_loss - model1_loss) / model1_loss * 100).toFixed(1)
  let flops_change = ((model2_flops - model1_flops) / model1_flops * 100).toFixed(1)
  let memory_change = ((memory2 - memory1) / memory1 * 100).toFixed(1)

  // Format positive values with + sign
  params_change = params_change > 0 ? `+${params_change}` : `${params_change}`;
  tokens_change = tokens_change > 0 ? `+${tokens_change}` : `${tokens_change}`;
  loss_change = loss_change > 0 ? `+${loss_change}` : `${loss_change}`;
  flops_change = flops_change > 0 ? `+${flops_change}` : `${flops_change}`;
  memory_change = memory_change > 0 ? `+${memory_change}` : `${memory_change}`;


  // Prep explainer text

  explainer = `<h4 id="notes">Notes:</h4><ul>`

  if (mode.value === "iso_loss")
    explainer += `<li>To achieve the same loss as Model 1, Model 2 would need to be trained with ${tokens2}B tokens.</li>`;


  if (inf_breakeven_tokens != "0")
    explainer += `<li>Model 1 and Model 2 achieve total compute breakeven after ${inf_breakeven_tokens} billion inference tokens.</li>`;


  // JS => HTML Content
   outputModelHTML = `
      <h2>Results</h2>
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
      </table>
      <p>${explainer}</p>`;

    // Push HTML to results div
    document.getElementById("results").innerHTML = outputModelHTML;

    // Draw Charts
    const inputTrainingFlops = model1_flops
    const outputTrainingFlops = model2_flops
    const inputInfFlops = model1_inf_flops
    const outputInfFlops = model2_inf_flops

    drawChart(inputTrainingFlops, outputTrainingFlops, inputInfFlops, outputInfFlops); 
    drawLossChart(loss_series1, loss_series2);
    total_compute_cost.style.display = "block"
    flops_chart.style.display = 'block';
    loss_chart.style.display = "block"


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
          labels: ['Model 1', 'Model 2'],
          datasets: [
            {
              label: 'Training FLOPS',
              data: [inputTrainingFlops, outputTrainingFlops],
              backgroundColor: ['#0077be', '#0077be'],
              stack: 'Stack 1',
              barThickness: 200 * mobile_multiple_03
            },
            {
              label: 'Inference FLOPs',
              data: [inputInfFlops, outputInfFlops],
              backgroundColor: ['#4CAF50', '#4CAF50'],
              stack: 'Stack 1',
              barThickness: 200 * mobile_multiple_03
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,  
          animation: {
              duration: 0
          },
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


let lossChart;

function drawLossChart(data1, data2) {
    // Get the canvas element
    const canvas = document.getElementById('lossChart');

    // Destroy the existing chart object (if it exists)
    if (lossChart) {
        lossChart.destroy();
    }

    // Convert tuples to point objects
    const points1 = data1.map(tuple => ({x: tuple[0], y: tuple[1]}));
    const points2 = data2.map(tuple => ({x: tuple[0], y: tuple[1]}));

    const dataSet1 = {
        label: "Model 1",
        data: points1,
        fill: false,
        borderColor: '#0077be',
        pointRadius: 0 // disable individual point markers
    };

    const dataSet2 = {
        label: "Model 2",
        data: points2,
        fill: false,
        borderColor: '#4CAF50',
        pointRadius: 0 // disable individual point markers
    };

    // Create the new chart object
    lossChart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [dataSet1, dataSet2]
        },
        options: {
           plugins: {
              legend: {
                position: 'bottom',
                 labels: {
                    padding: 30, 
                    boxWidth: 40, 
                }
              },
            },
            maintainAspectRatio: false,  
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Training FLOPs',
                    },
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Test Loss',
                    },
                },
            },
        },
    });
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
