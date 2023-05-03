document.addEventListener("keydown", event => {
  if (event.keyCode === 13) { // 13 is the key code for the enter key
    document.getElementById("calculate").click();
  }
});


document.getElementById("calculate").addEventListener("click", async () => {
    const parameters = document.getElementById("parameters").value;
    const trainingTokens = document.getElementById("trainingTokens").value;
    const compactModelParameters = document.getElementById("compactModelParameters").value;
    const inferences = document.getElementById("inferences").value;

    const response = await fetch("/api/calculate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ parameters, trainingTokens, compactModelParameters, inferences})
    });

    const data = await response.json();

    // Display Input Model loss, compute, and cost
    document.getElementById("estimated-loss").textContent = data.input_model.loss;
    
    const costValue = data.input_model.cost;
    const formattedCostValue = "$" + costValue.toLocaleString();
    document.getElementById("cost").textContent = formattedCostValue;


    const inputTrainingFlops = data.input_model.compute;
    const inputInfFlops = data.input_model.original_inf_cost;
    const formattedinputTrainingFlops = inputTrainingFlops.toExponential(2);
    document.getElementById("compute").textContent = formattedinputTrainingFlops;


    // Display Compact Model loss, compute, and cost
    document.getElementById("new_estimated-loss").textContent = data.output_model.loss;

    const outputTrainingFlops = data.output_model.compute;
    const outputInfFlops = data.output_model.compact_inf_cost;

    const formattedoutputTrainingFlops = outputTrainingFlops.toExponential(2);
    document.getElementById("new_compute").textContent = formattedoutputTrainingFlops;

    const costValueNew = data.output_model.cost;
    const formattedCostValueNew = "$" + costValueNew.toLocaleString();
    document.getElementById("new_cost").textContent = formattedCostValueNew;

    document.getElementById("otc").textContent = data.output_model.otc; 

    document.getElementById("inf_breakeven").textContent = data.output_model.inf_breakeven


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
    labels: ['Input Model', 'Compacted Model'],
    datasets: [
      {
        label: 'Training FLOPS',
        data: [inputTrainingFlops, outputTrainingFlops],
        backgroundColor: ['#3e95cd', '#3e95cd'],
        stack: 'Stack 1'
      },
      {
        label: 'Inference FLOPs',
        data: [inputInfFlops, outputInfFlops],
        backgroundColor: ['#8e5ea2', '#8e5ea2'],
        stack: 'Stack 1'
      }
    ]
  },
  options: {
    scales: {
      xAxes: [{
        stacked: true, // Enable stacked bar chart for the x-axis
        scaleLabel: {
          display: true,
          labelString: 'X-axis Label',
          fontSize: 24
        },
        ticks: {
          fontSize: 14 // Set the font size for the x-axis tick labels
        }
      }],
      yAxes: [{
        stacked: true, // Enable stacked bar chart for the y-axis
        scaleLabel: {
          display: true,
          labelString: 'Y-axis Label',
          fontSize: 24
        },
        ticks: {
          beginAtZero: true, // Start the y-axis scale at zero
          fontSize: 14 // Set the font size for the y-axis tick labels
        }
      }]
    }
  }
});




});
