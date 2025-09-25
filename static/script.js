
// Search functionality
function searchSummoner() {
    const summonerInput = document.getElementById('summonerInput');
    const riotId = summonerInput.value.trim();
    
    if (!riotId) {
        showNotification('Wprowadź Riot ID (nazwa#tag)', 'error');
        return;
    }
    
    if (!riotId.includes('#')) {
        showNotification('Nieprawidłowy format. Użyj: nazwa#tag (np. Player#EUW)', 'error');
        return;
    }
    
    // Add to recent searches
    addToRecentSearches(riotId);
    
    // Redirect to summoner profile
    window.location.href = `/summoner/${encodeURIComponent(riotId)}`;
}

function searchSpecific(riotId) {
    document.getElementById('summonerInput').value = riotId;
    searchSummoner();
}

// Recent searches functionality
function addToRecentSearches(riotId) {
    let recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    recent = recent.filter(id => id.toLowerCase() !== riotId.toLowerCase());
    recent.unshift(riotId);
    recent = recent.slice(0, 5); // Keep only 5 recent searches
    localStorage.setItem('recentSearches', JSON.stringify(recent));
    updateRecentSearchesUI();
}

function updateRecentSearchesUI() {
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const recentSection = document.getElementById('recentSearches');
    const recentList = document.getElementById('recentList');
    
    if (recentSearches.length > 0) {
        recentSection.style.display = 'block';
        recentList.innerHTML = recentSearches.map(name => 
            `<a href="/summoner/${encodeURIComponent(name)}" class="recent-item">${name}</a>`
        ).join('');
    }
}

// Load summoner data
async function loadSummonerData(riotId) {
    const profileHeader = document.getElementById('profileHeader');
    const profileContent = document.getElementById('profileContent');
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        const response = await fetch(`/api/summoner/${encodeURIComponent(riotId)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Nie udało się pobrać danych gracza');
        }
        
        // Update profile header
        if (profileHeader) {
            profileHeader.innerHTML = `
                <div class="summoner-info">
                    <img src="https://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${data.summoner.profileIconId}.png" 
                         alt="Profile Icon" class="summoner-avatar">
                    <div class="summoner-details">
                        <h1>${data.summoner.gameName}<span class="tag-line">#${data.summoner.tagLine}</span></h1>
                        <span class="summoner-level">Poziom ${data.summoner.level}</span>
                    </div>
                </div>
            `;
        }
        
        // Update rank info
        const rankInfo = document.getElementById('rankInfo');
        if (rankInfo) {
            const winrate = (data.ranked.wins + data.ranked.losses) > 0 ? 
                Math.round((data.ranked.wins / (data.ranked.wins + data.ranked.losses)) * 100) : 0;
            
            rankInfo.innerHTML = `
                <div class="rank-info">
                    <div class="rank-badge">
                        <img src="https://opgg-static.akamaized.net/images/medals_new/${data.ranked.tier.toLowerCase()}.png" alt="${data.ranked.tier}">
                        <div>${data.ranked.tier} ${data.ranked.rank}</div>
                    </div>
                    <div class="rank-details">
                        <h4>${data.ranked.leaguePoints} LP</h4>
                        <div class="rank-stats">
                            <div class="stat-item">
                                <div>${data.ranked.wins}W</div>
                                <div>Wygrane</div>
                            </div>
                            <div class="stat-item">
                                <div>${data.ranked.losses}L</div>
                                <div>Przegrane</div>
                            </div>
                            <div class="stat-item">
                                <div>${winrate}%</div>
                                <div>Winrate</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Update recent matches
        const matchesList = document.getElementById('matchesList');
        if (matchesList && data.recentMatches) {
            matchesList.innerHTML = data.recentMatches.map(match => `
                <div class="match-item">
                    <img src="https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${match.champion}.png" 
                         alt="${match.champion}" class="match-champion">
                    <div class="match-details">
                        <div class="match-champion-name">${match.champion}</div>
                        <div class="match-mode">${match.gameMode}</div>
                    </div>
                    <div class="match-result ${match.result.toLowerCase()}">
                        ${match.result}
                    </div>
                    <div class="match-kda">${match.kda}</div>
                    <div class="match-duration">${match.duration}</div>
                </div>
            `).join('');
        }
        
        // Store match data for AI analysis
        window.currentSummonerData = data;
        
        if (profileContent) {
            profileContent.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading summoner data:', error);
        if (errorMessage) {
            errorMessage.style.display = 'block';
        }
    }
}

// AI Analysis functionality
async function requestAIAnalysis() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisResult = document.getElementById('analysisResult');
    
    if (!analyzeBtn || !analysisResult) {
        console.error('Required elements not found');
        return;
    }
    
    if (!window.currentSummonerData) {
        showNotification('Brak danych do analizy', 'error');
        return;
    }
    
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizuję...';
    
    try {
        const response = await fetch('/api/analyze-performance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                summoner_name: window.currentSummonerData.summoner.riotId,
                match_history: window.currentSummonerData.recentMatches
            })
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Non-JSON response:', textResponse);
            throw new Error('Serwer zwrócił nieprawidłową odpowiedź');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Wystąpił błąd podczas analizy');
        }
        
        analysisResult.textContent = data.analysis;
        analysisResult.style.display = 'block';
        
        // Scroll to results
        analysisResult.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error during AI analysis:', error);
        showNotification(error.message || 'Wystąpił błąd podczas analizy', 'error');
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-magic"></i> Analizuj wydajność gracza';
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff6b6b' : '#4ecdc4'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

// Enter key support for search
document.addEventListener('DOMContentLoaded', function() {
    const summonerInput = document.getElementById('summonerInput');
    if (summonerInput) {
        summonerInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchSummoner();
            }
        });
    }
    
    // Load recent searches on homepage
    if (window.location.pathname === '/') {
        updateRecentSearchesUI();
    }
});
