from google.oauth2 import service_account
from google.auth.transport.requests import Request
import requests
import json

credentials = service_account.Credentials.from_service_account_file(
    # make sure this is the right path for the service account json key file
    'incorta-ai-agent-68c6d0139044.json',
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)

def get_access_token():
    credentials.refresh(Request())
    return credentials.token

def make_discovery_engine_request(query_text):
    access_token = get_access_token()
    
    url = "https://discoveryengine.googleapis.com/v1alpha/projects/659680475186/locations/global/collections/default_collection/engines/incorta-docs-searcher_1753768303750/servingConfigs/default_search:answer"
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "query": {"text": query_text, "queryId": ""},
        "session": "",
        "relatedQuestionsSpec": {"enable": True},
        "answerGenerationSpec": {
            "ignoreAdversarialQuery": True,
            "ignoreNonAnswerSeekingQuery": False,
            "ignoreLowRelevantContent": True,
            "multimodalSpec": {},
            "includeCitations": True,
            "modelSpec": {"modelVersion": "stable"}
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# take in a query with --query and return the response in main
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Query the Discovery Engine API.')
    parser.add_argument('--query', type=str, required=True, help='The query text to send to the API.')
    
    args = parser.parse_args()
    
    response = make_discovery_engine_request(args.query)
    print(json.dumps(response, indent=2)) 