import json
import requests
import os

def fetch_jlpt_words():
    """Fetch words from the JLPT API."""
    url = "https://jlpt-vocab-api.vercel.app/api/words/all"
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad HTTP responses
    return response.json()

def process_words(words):
    """Process and sort words by difficulty level."""
    processed = {
        "easy": [],    # N5 words
        "medium": [],  # N4-N3 words
        "hard": []     # N2-N1 words
    }
    
    for word in words:
        # Validate word structure
        if not all(key in word for key in ["word", "meaning", "furigana", "romaji", "level"]):
            continue
            
        # Sort by level
        if word["level"] == 5:
            processed["easy"].append(word)
        elif word["level"] in [3, 4]:
            processed["medium"].append(word)
        elif word["level"] in [1, 2]:
            processed["hard"].append(word)
            
    return processed

def save_to_json(data, target_path="words_ja.json"):
    """Save processed data to a JSON file."""
    # Ensure the directory exists
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved to {target_path}")

def main():
    print("Fetching words from API...")
    words = fetch_jlpt_words()
    
    print("Processing words...")
    processed_words = process_words(words)
    
    print("Saving to words_ja.json...")
    save_to_json(processed_words, target_path="./words_ja.json")
    
    print("\nStatistics:")
    for category, word_list in processed_words.items():
        print(f"{category}: {len(word_list)} words")

if __name__ == "__main__":
    main()

