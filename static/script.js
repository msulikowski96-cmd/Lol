
async function analyzeText() {
    const textInput = document.getElementById('textInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const resultsSection = document.getElementById('resultsSection');
    const errorDiv = document.getElementById('error');
    const originalText = document.getElementById('originalText');
    const analysisResult = document.getElementById('analysisResult');
    const errorMessage = document.getElementById('errorMessage');
    
    const text = textInput.value.trim();
    
    if (!text) {
        showError('Proszę wprowadzić tekst do analizy');
        return;
    }
    
    // Show loading state
    loading.style.display = 'block';
    resultsSection.style.display = 'none';
    errorDiv.style.display = 'none';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analizuję...';
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Wystąpił błąd podczas analizy');
        }
        
        // Show results
        originalText.textContent = data.original_text;
        analysisResult.textContent = data.analysis;
        
        loading.style.display = 'none';
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Wystąpił nieoczekiwany błąd');
        loading.style.display = 'none';
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analizuj tekst';
    }
}

function clearText() {
    const textInput = document.getElementById('textInput');
    const resultsSection = document.getElementById('resultsSection');
    const errorDiv = document.getElementById('error');
    
    textInput.value = '';
    resultsSection.style.display = 'none';
    errorDiv.style.display = 'none';
    textInput.focus();
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Enable analyze button with Enter key
document.getElementById('textInput').addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        analyzeText();
    }
});

// Auto-resize textarea
document.getElementById('textInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});
