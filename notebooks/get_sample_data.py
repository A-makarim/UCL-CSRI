import http.client
import requests
import json

## Get list of data thru API keys
def get_sample_json():
    area_codes = {
        "discoveredAt": "2026-01-31T13:46:23.589Z",
        "totalCodes": 120,
        "prefixes": {
            "W": [
            "W1",
            "W2",
            "W3",
            "W4",
            "W5",
            "W6",
            "W7",
            "W8",
            "W9",
            "W10",
            "W11",
            "W12",
            "W13",
            "W14"
            ],
            "SW": [
            "SW1",
            "SW2",
            "SW3",
            "SW4",
            "SW5",
            "SW6",
            "SW7",
            "SW8",
            "SW9",
            "SW10",
            "SW11",
            "SW12",
            "SW13",
            "SW14",
            "SW15",
            "SW16",
            "SW17",
            "SW18",
            "SW19",
            "SW20"
            ],
            "NW": [
            "NW1",
            "NW2",
            "NW3",
            "NW4",
            "NW5",
            "NW6",
            "NW7",
            "NW8",
            "NW9",
            "NW10",
            "NW11"
            ],
            "N": [
            "N1",
            "N2",
            "N3",
            "N4",
            "N5",
            "N6",
            "N7",
            "N8",
            "N9",
            "N10",
            "N11",
            "N12",
            "N13",
            "N14",
            "N15",
            "N16",
            "N17",
            "N18",
            "N19",
            "N20",
            "N21",
            "N22"
            ],
            "E": [
            "E1",
            "E2",
            "E3",
            "E4",
            "E5",
            "E6",
            "E7",
            "E8",
            "E9",
            "E10",
            "E11",
            "E12",
            "E13",
            "E14",
            "E15",
            "E16",
            "E17",
            "E18",
            "E20"
            ],
            "SE": [
            "SE1",
            "SE2",
            "SE3",
            "SE4",
            "SE5",
            "SE6",
            "SE7",
            "SE8",
            "SE9",
            "SE10",
            "SE11",
            "SE12",
            "SE13",
            "SE14",
            "SE15",
            "SE16",
            "SE17",
            "SE18",
            "SE19",
            "SE20",
            "SE21",
            "SE22",
            "SE23",
            "SE24",
            "SE25",
            "SE26",
            "SE27",
            "SE28"
            ],
            "EC": [
            "EC1",
            "EC2",
            "EC3",
            "EC4"
            ],
            "WC": [
            "WC1",
            "WC2"
            ]
        },
        "allCodes": [
            "W1",
            "W2",
            "W3",
            "W4",
            "W5",
            "W6",
            "W7",
            "W8",
            "W9",
            "W10",
            "W11",
            "W12",
            "W13",
            "W14",
            "SW1",
            "SW2",
            "SW3",
            "SW4",
            "SW5",
            "SW6",
            "SW7",
            "SW8",
            "SW9",
            "SW10",
            "SW11",
            "SW12",
            "SW13",
            "SW14",
            "SW15",
            "SW16",
            "SW17",
            "SW18",
            "SW19",
            "SW20",
            "NW1",
            "NW2",
            "NW3",
            "NW4",
            "NW5",
            "NW6",
            "NW7",
            "NW8",
            "NW9",
            "NW10",
            "NW11",
            "N1",
            "N2",
            "N3",
            "N4",
            "N5",
            "N6",
            "N7",
            "N8",
            "N9",
            "N10",
            "N11",
            "N12",
            "N13",
            "N14",
            "N15",
            "N16",
            "N17",
            "N18",
            "N19",
            "N20",
            "N21",
            "N22",
            "E1",
            "E2",
            "E3",
            "E4",
            "E5",
            "E6",
            "E7",
            "E8",
            "E9",
            "E10",
            "E11",
            "E12",
            "E13",
            "E14",
            "E15",
            "E16",
            "E17",
            "E18",
            "E20",
            "SE1",
            "SE2",
            "SE3",
            "SE4",
            "SE5",
            "SE6",
            "SE7",
            "SE8",
            "SE9",
            "SE10",
            "SE11",
            "SE12",
            "SE13",
            "SE14",
            "SE15",
            "SE16",
            "SE17",
            "SE18",
            "SE19",
            "SE20",
            "SE21",
            "SE22",
            "SE23",
            "SE24",
            "SE25",
            "SE26",
            "SE27",
            "SE28",
            "EC1",
            "EC2",
            "EC3",
            "EC4",
            "WC1",
            "WC2"
        ],
        "note": "Using comprehensive London district codes"
        }

    # Generate postcodes using a subset of 20 prefixes from area_codes['allCodes']
    ## subset_prefixes = area_codes['allCodes'][:1]  # Take the first 20 prefixes
    
    # All possible suffixes (1 digit followed by 2 letters)
    all_suffixes = [f"{i}{chr(j)}{chr(k)}" for i in range(1, 10) for j in range(65, 91) for k in range(65, 91)]
    
    # Hardcoded random subset of 100 suffixes for consistent testing
    suffixes = ['8OR', '9UU', '6EN', '5NI', '7IJ', '9ZD', '8TH', '2JB', '3PS', '4TA', '1SC', '1DG', '4DJ', '9SA', '1OW', '4JM', '2LE', '2UE', '1DI', '5UU', '7GW', '1CX', '5WS', '4QP', '6ZI', '5AV', '3CE', '1SK', '7QA', '7AO', '9DP', '2OW', '4OR', '8TG', '3MO', '6ZK', '6XZ', '1GB', '7RC', '8ZZ', '8ZM', '9DX', '8GC', '1TS', '1MU', '1BJ', '1UQ', '4DT', '2WG', '4QL', '2ZL', '9LU', '8DQ', '7DO', '3VX', '7UO', '8DN', '9PN', '6OS', '8LB', '3ME', '3JP', '2NN', '6AQ', '8WU', '5GB', '4TV', '7PN', '6GA', '9HI', '4LI', '8AC', '6BV', '6PJ', '7CY', '3XY', '8LU', '4VG', '9BV', '9XJ', '2PW', '1LD', '7YK', '3PW', '3VB', '4MH', '4UW', '9UW', '4NZ', '9KJ', '7GN', '8BK', '4GC', '8BO', '2LQ', '9JN', '1RJ', '3AY', '8TA', '8UL']

    sale_history_data = {}
    headers = {'X-Auth-Token': "a6ce7265-eb07-4911-9a8c-2da7ed00a069"}
    conn = http.client.HTTPSConnection("api.scansan.com")
    postcode_list = ["W1H 1BP", "SW3 1AJ", "E4 0DE"]

    for postcode in postcode_list:
        postcode_encoded = postcode.replace(" ", "%20")
        
        print(f"Fetching data for postcode: {postcode}")
        conn.request("GET", f"/v1/postcode/{postcode_encoded}/valuations/historical", headers=headers)
        res = conn.getresponse()
        if res.status == 200:
            sale_history_data[postcode] = json.loads(res.read().decode())
    
    conn.close()

    # Store the output as a JSON file
    with open("sale_history_data.json", "w") as json_file:
        json.dump(sale_history_data, json_file, indent=4)
        
    return sale_history_data

def json_to_csv():
    """Convert sale_history_data.json to CSV format with one row per valuation"""
    import csv
    from datetime import datetime
    
    # Load the JSON file
    with open("sale_history_data.json", "r") as json_file:
        data = json.load(json_file)
    
    # Prepare CSV data
    rows = []
    
    # Iterate through each postcode
    for postcode, postcode_data in data.items():
        # Iterate through each property
        for property_entry in postcode_data.get("data", []):
            # Iterate through each valuation
            for valuation_entry in property_entry.get("valuations", []):
                # Extract and simplify date to YYYY-MM format
                date_str = valuation_entry.get("date", "")
                if date_str:
                    # Parse the ISO format date and extract year-month
                    date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    simplified_date = date_obj.strftime("%Y-%m")
                else:
                    simplified_date = ""
                
                row = {
                    "postcode": postcode,
                    "date": simplified_date,
                    "valuation": valuation_entry.get("valuation", "")
                }
                rows.append(row)
    
    # Write to CSV file
    with open("sale_history_data.csv", "w", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=["postcode", "date", "valuation"])
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"CSV file created with {len(rows)} rows")

if __name__ == "__main__":
    json_to_csv()