import os
import sys
from dotenv import load_dotenv

# Add the project root directory to the Python path to resolve the ModuleNotFoundError
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents.congress_agent import get_congress_info
 
 # Load environment variables from .env file
load_dotenv()
 
def main():
     """
     Main function to run the terminal-based chatbot.
     """
     print("Congress Info Chatbot")
     print("Ask a question about a US Congress representative (or type 'exit' to quit).")
 
     while True:
         user_input = input("> ")
         if user_input.lower() == "exit":
             break
         
         response = get_congress_info(user_input)
         print(response)
 
if __name__ == "__main__":
     main()