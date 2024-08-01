from flask import Flask, request, jsonify, send_from_directory
import base64
import io
from PIL import Image
import openai
import os
from google.cloud import vision
import logging
import pandas as pd
from datetime import datetime

application = Flask(__name__)

# Setup logging
logging.basicConfig(level=logging.DEBUG)

openai.api_key = os.getenv('OPENAI_API_KEY')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "food-vision-428119-417bab13d91e.json"

client = vision.ImageAnnotatorClient()

EXCEL_FILE = 'food_macronutrients.xlsx'


def detect_labels(image_content):
    try:
        image = vision.Image(content=image_content)
        response = client.label_detection(image=image)
        labels = response.label_annotations
        if response.error.message:
            raise Exception(response.error.message)

        logging.debug(f"Detected labels: {[label.description for label in labels]}")
        return [label.description for label in labels]
    except Exception as e:
        logging.error(f"Error in detect_labels: {str(e)}")
        return {"error": str(e)}


def get_macronutrient_info(food_items):
    try:
        food_items_str = ", ".join(food_items)
        logging.debug(f"Sending food items to GPT-4: {food_items_str}")
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides macronutrient information. "
                                              "You will receive the picture of a dish or food item. "
                                              "You do not care about different types of items but will only give a "
                                              "rough estimate of the macronutrients of food that you see in the "
                                              "picture in this format: protein, calories, carbs, fat, sugar, "
                                              "and cholesterol, in that order. Don't say anything else."},
                {"role": "user",
                 "content": f"Provide the macronutrient information for the following food items: {food_items_str}. "
                            f"Only give a rough estimate of protein, calories, carbs, fat, sugar, and cholesterol, "
                            f"in that order. Don't say anything more than what you've been instructed in the system."
                            "Give me a one line answer with what I asked for and always give me the information in "
                            "the same order nothing more"}
            ],
            max_tokens=150
        )
        result_text = response.choices[0].message['content'].strip()
        logging.debug(f"Response from GPT-4: {result_text}")
    except Exception as e:
        logging.error(f"Error in get_macronutrient_info: {str(e)}")
        return {"error": str(e)}

    result = {}
    try:
        nutrients = ['protein', 'calories', 'carbs', 'fat', 'sugar', 'cholesterol']
        values = result_text.split(',')
        if len(values) != len(nutrients):
            raise ValueError("Unexpected response format")

        for i in range(len(nutrients)):
            result[nutrients[i]] = values[i].strip()

    except Exception as e:
        logging.error(f"Error parsing GPT-4 response: {str(e)}")
        return {"error": "Error parsing GPT-4 response"}

    logging.debug(f"Parsed macronutrient info: {result}")
    return result


def save_to_excel(food_name, macronutrient_info):
    try:
        # Create data dictionary with formatted timestamp
        data = {
            'timestamp': [datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            'protein': [macronutrient_info.get('protein')],
            'calories': [macronutrient_info.get('calories')],
            'carbs': [macronutrient_info.get('carbs')],
            'fat': [macronutrient_info.get('fat')],
            'sugar': [macronutrient_info.get('sugar')],
            'cholesterol': [macronutrient_info.get('cholesterol')]
        }
        df = pd.DataFrame(data)
        if os.path.exists(EXCEL_FILE):
            existing_df = pd.read_excel(EXCEL_FILE)
            df = pd.concat([existing_df, df], ignore_index=True)
        df.to_excel(EXCEL_FILE, index=False)
        logging.debug("Data saved to Excel.")
    except Exception as e:
        logging.error(f"Error saving to Excel: {str(e)}")



@application.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    image_data = data['image']

    try:
        logging.debug("Received image for analysis.")
        image_content = base64.b64decode(image_data.split(',')[1])
        food_items = detect_labels(image_content)
        if "error" in food_items:
            return jsonify({"error": food_items["error"]})
        analysis_result = get_macronutrient_info(food_items)
        logging.debug(f"Analysis result: {analysis_result}")

        # Save to Excel
        if isinstance(food_items, list) and len(food_items) > 0:
            save_to_excel(food_items[0], analysis_result)

        return jsonify(analysis_result)
    except Exception as e:
        logging.error(f"Error in /analyze endpoint: {str(e)}")
        return jsonify({"error": str(e)})


@application.route('/chatbot', methods=['POST'])
def chatbot():
    data = request.get_json()
    user_message = data.get('message')

    try:
        logging.debug("Received message for chatbot.")
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a knowledgeable assistant on the diabetes field "
                                              "and you are here to answer any diabetes-related questions."
                                              "If a non diabetes related questions is asked under no circumstances"
                                              "you shall answer to it.F"
                                              "When answering the answer try to not say too much but really "
                                              "what's important. "},
                {"role": "user", "content": user_message}
            ],
            max_tokens=150 
        )
        bot_reply = response.choices[0].message['content'].strip()
        logging.debug(f"Response from GPT-4: {bot_reply}")
        return jsonify({"reply": bot_reply})
    except Exception as e:
        logging.error(f"Error in /chatbot endpoint: {str(e)}")
        return jsonify({"error": str(e)})


@application.route('/')
def index():
    return send_from_directory('.', 'index.html')


@application.route('/app.js')
def serve_js():
    return send_from_directory('.', 'app.js')


if __name__ == '__main__':
    application.run(debug=True)
