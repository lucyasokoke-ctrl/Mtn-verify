// Navigate between the calculator and application screens
function goToStep(step) {
    const calculator = document.getElementById('view-calc');
    const application = document.getElementById('view-step1');

    if (!calculator || !application) {
        console.error('Application screen elements were not found.');
        return;
    }

    calculator.classList.add('hidden');
    application.classList.add('hidden');

    if (step === 'calc') {
        calculator.classList.remove('hidden');
    } else if (step === 1) {
        application.classList.remove('hidden');
    }
}

// Update the displayed loan amount when the slider moves
function updateCalc() {
    const slider = document.getElementById('amt-slider');
    const amountDisplay = document.getElementById('calc-amt-val');

    if (!slider || !amountDisplay) return;

    const amount = Number(slider.value);

    amountDisplay.textContent = 'ZMW ' +
        amount.toLocaleString('en-US');
}
