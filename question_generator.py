import os
from dotenv import load_dotenv
import google.generativeai as genai
import sys
import random
import json

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise Exception("GEMINI_API_KEY not found in environment")

genai.configure(api_key=api_key)

model = genai.GenerativeModel("gemini-2.0-flash-lite")


def generate_question(text, keyword, q_type, difficulty, index):
    prompt = f"""
    From the following input, generate a {q_type} type question with {difficulty} difficulty.
    Focus on the keyword: {keyword}.
    Do not repeat earlier questions.

    Input:
    {text}

    Output:
    """
    try:
        response = model.generate_content(prompt)
        raw_output = response.text.strip()

        question = raw_output
        options = []
        correct_answer = None

        if q_type == "MCQ":
            lines = question.split("\n")
            question = lines[0]
            options = [line.strip("- ").strip()
                       for line in lines[1:] if line.strip()]
            correct_answer = random.randint(
                0, len(options)-1) if options else None

        return {
            "id": index + 1,
            "question": question,
            "options": options,
            "correctAnswer": correct_answer,
            "type": q_type,
            "difficulty": difficulty,
            "keyword": keyword
        }
    except Exception as e:
        return {"error": str(e), "id": index + 1}


def main():
    if len(sys.argv) != 5:
        print("Usage: python question_generator.py <topic> <type> <difficulty> <num_questions>")
        sys.exit(1)

    topic = sys.argv[1]
    q_type = sys.argv[2]
    difficulty = sys.argv[3]
    num_questions = int(sys.argv[4])

    words = topic.split()
    keywords = [word for word in words if len(word) > 3] or words

    questions = []
    for i in range(num_questions):
        keyword = random.choice(keywords)
        question = generate_question(topic, keyword, q_type, difficulty, i)
        questions.append(question)

    print(json.dumps(questions))


if __name__ == "__main__":
    main()
