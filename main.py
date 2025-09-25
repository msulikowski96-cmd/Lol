
from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

# Riot Games API configuration
RIOT_API_KEY = os.getenv('RIOT_API_KEY', 'your-riot-api-key-here')
OPENROUTE_API_KEY = os.getenv('OPENROUTE_API_KEY', 'your-openroute-api-key-here')
OPENROUTE_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Riot API endpoints
RIOT_BASE_URL = "https://euw1.api.riotgames.com"
EUROPE_BASE_URL = "https://europe.api.riotgames.com"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summoner/<path:riot_id>')
def summoner_profile(riot_id):
    return render_template('summoner.html', riot_id=riot_id)

@app.route('/api/summoner/<path:riot_id>')
def get_summoner_data(riot_id):
    try:
        # Parse gamename and tag from riot_id (format: gamename#tag)
        if '#' not in riot_id:
            return jsonify({'error': 'Invalid Riot ID format. Use gamename#tag'}), 400
        
        gamename, tag = riot_id.split('#', 1)
        
        # Get account info using Riot ID (gamename + tag)
        account_url = f"{EUROPE_BASE_URL}/riot/account/v1/accounts/by-riot-id/{gamename}/{tag}"
        headers = {'X-Riot-Token': RIOT_API_KEY}
        
        # Get account by Riot ID
        account_response = requests.get(account_url, headers=headers)
        if account_response.status_code != 200:
            if account_response.status_code == 404:
                return jsonify({'error': 'Account not found'}), 404
            return jsonify({'error': f'API Error: {account_response.status_code}'}), 500
        
        account_data = account_response.json()
        puuid = account_data['puuid']
        
        # Get summoner info by PUUID
        summoner_url = f"{RIOT_BASE_URL}/lol/summoner/v4/summoners/by-puuid/{puuid}"
        summoner_response = requests.get(summoner_url, headers=headers)
        if summoner_response.status_code != 200:
            return jsonify({'error': 'Summoner not found'}), 404
        
        summoner_data = summoner_response.json()
        
        # Get ranked info
        ranked_url = f"{RIOT_BASE_URL}/lol/league/v4/entries/by-summoner/{summoner_data['id']}"
        ranked_response = requests.get(ranked_url, headers=headers)
        ranked_data = ranked_response.json() if ranked_response.status_code == 200 else []
        
        # Find Solo/Duo queue data
        solo_queue = next((entry for entry in ranked_data if entry['queueType'] == 'RANKED_SOLO_5x5'), None)
        
        # Get recent matches
        matches_url = f"{EUROPE_BASE_URL}/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=10"
        matches_response = requests.get(matches_url, headers=headers)
        match_ids = matches_response.json() if matches_response.status_code == 200 else []
        
        recent_matches = []
        for match_id in match_ids[:5]:  # Get details for first 5 matches
            match_url = f"{EUROPE_BASE_URL}/lol/match/v5/matches/{match_id}"
            match_response = requests.get(match_url, headers=headers)
            if match_response.status_code == 200:
                match_data = match_response.json()
                # Find participant data
                participant = next((p for p in match_data['info']['participants'] if p['puuid'] == puuid), None)
                if participant:
                    recent_matches.append({
                        'champion': participant['championName'],
                        'result': 'Victory' if participant['win'] else 'Defeat',
                        'kda': f"{participant['kills']}/{participant['deaths']}/{participant['assists']}",
                        'duration': f"{match_data['info']['gameDuration']//60}:{match_data['info']['gameDuration']%60:02d}",
                        'gameMode': match_data['info']['gameMode']
                    })
        
        result_data = {
            'summoner': {
                'gameName': account_data['gameName'],
                'tagLine': account_data['tagLine'],
                'riotId': riot_id,
                'level': summoner_data['summonerLevel'],
                'profileIconId': summoner_data['profileIconId'],
                'puuid': puuid
            },
            'ranked': {
                'tier': solo_queue['tier'] if solo_queue else 'UNRANKED',
                'rank': solo_queue['rank'] if solo_queue else '',
                'leaguePoints': solo_queue['leaguePoints'] if solo_queue else 0,
                'wins': solo_queue['wins'] if solo_queue else 0,
                'losses': solo_queue['losses'] if solo_queue else 0
            },
            'recentMatches': recent_matches
        }
        
        return jsonify(result_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-performance', methods=['POST'])
def analyze_performance():
    try:
        data = request.get_json()
        summoner_name = data.get('summoner_name', '')
        match_history = data.get('match_history', [])
        
        if not summoner_name:
            return jsonify({'error': 'No summoner name provided'}), 400
        
        # AI analysis of player performance
        analysis_result = analyze_player_with_ai(summoner_name, match_history)
        
        return jsonify({
            'summoner_name': summoner_name,
            'analysis': analysis_result,
            'status': 'success'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def analyze_player_with_ai(summoner_name, match_history):
    """
    AI analysis of player performance using OpenRoute AI
    """
    try:
        headers = {
            'Authorization': f'Bearer {OPENROUTE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Prepare match data for analysis
        matches_text = "\n".join([
            f"Champion: {match.get('champion', 'Unknown')}, "
            f"Result: {match.get('result', 'Unknown')}, "
            f"KDA: {match.get('kda', 'Unknown')}, "
            f"Duration: {match.get('duration', 'Unknown')}"
            for match in match_history
        ])
        
        payload = {
            "model": "microsoft/wizardlm-2-8x22b",  # You can change this to your preferred model
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional League of Legends coach and analyst. Analyze the player's performance and provide constructive feedback, strengths, weaknesses, and improvement suggestions."
                },
                {
                    "role": "user",
                    "content": f"Analyze the performance of summoner '{summoner_name}' based on their recent matches:\n\n{matches_text}\n\nProvide detailed analysis including strengths, weaknesses, and specific improvement recommendations."
                }
            ],
            "max_tokens": 1500,
            "temperature": 0.7
        }
        
        # Uncomment when you have your API key
        # response = requests.post(OPENROUTE_API_URL, headers=headers, json=payload)
        # if response.status_code == 200:
        #     return response.json()['choices'][0]['message']['content']
        # else:
        #     return f"Error: {response.status_code}"
        
        # Mock analysis for demonstration
        return f"""
🎯 **Analiza wydajności dla {summoner_name}**

**Mocne strony:**
• Dobra kontrola damage'u - średnie KDA powyżej 2.0
• Solidny wybór championów (ADC main)
• Konsystentność w grze

**Obszary do poprawy:**
• Pozycjonowanie w team fightach
• Vision control - więcej wardów
• Farming w późnej grze

**Rekomendacje:**
1. Pracuj nad pozycjonowaniem - trzymaj się z tyłu w starciach
2. Kup więcej Control Wardów (cel: 2-3 na grę)
3. Trenuj last-hitting w Practice Tool

**Ogólna ocena:** 7.5/10 - Solidny gracz z potencjałem na awans!
        """
        
    except Exception as e:
        return f"Błąd analizy: {str(e)}"

@app.route('/champions')
def champions():
    return render_template('champions.html')

@app.route('/leaderboard')
def leaderboard():
    return render_template('leaderboard.html')

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
