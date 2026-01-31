import requests

url = "https://api.scansan.com/v1/area_codes/search"
params = {"area_name": "Hammersmith"}
headers = {
    "X-Auth-Token": "Y5cc86a4c-daf0-456f-85da-489720867777",
    "Content-Type": "application/json"
}

response = requests.get(url, params=params, headers=headers)
data = response.json()