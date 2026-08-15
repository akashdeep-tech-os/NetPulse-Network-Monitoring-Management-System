import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "IP List"

ws.append(["Camera Location", "Camera Setup Location", "Static IP"])

data = [
    ("Main Road in front of Shakur Basti Rly Station", "In restaurant 5 star Dhaba", "http://122.176.120.218:1236/"),
    ("Madhuban Chowk to Dipali chowk main road", "Police Integrated Booth", "http://122.176.123.248:1234/"),
    ("Outer Ring Road In front of Navjeevan Hospital", "Basement of Navjeevan Hospital", "http://122.176.125.112:1234/"),
    ("Outer Ring Road In front of Navjeevan Hospital", "Basement of Navjeevan Hospital", "http://122.176.125.112:1236/"),
    ("Avantika Chowk Corner Property Dealer office", "Dealer office", "http://122.176.157.101:1234/"),
    ("Avantika Chowk Corner Property Dealer office", "Dealer office", "http://122.176.157.101:1236/"),
    ("Shani Bazar T point", "Delhi Police Pink Booth", "183.83.222.15"),
    ("Mangol Puri to Kanjhawala Road", "Bagga Link Bajaj motorcycle showroom", "49.204.158.4"),
    ("Infront of Ekta appartment Gate no 2", "Guard room of ekta appt.", "http://182.77.58.231:1234/"),
    ("Infront of Ekta appartment Gate no 2", "Guard room of ekta appt.", "http://182.77.58.231:1236/"),
    ("Bhairon Enclave Round about In front of Hotel Dev Palace", "Hotel Dev Palace store room", "http://122.176.132.31:1236/"),
    ("Infront of McDonald", "2nd Floor of hotel D crown", "http://122.176.122.240:1233/"),
    ("Infront of McDonald", "2nd Floor of hotel D crown", "http://122.176.122.240:1234/"),
    ("Infront of Sehgal Hospital", "Maintenance room of Sehgal hospital", "183.83.220.109"),
    ("Jalebi chowk BG-8", "police booth", "183.83.220.99"),
    ("T- Point Madipur cut", "Madipur cut/left side hotel reception", "http://122.176.125.150:1234/"),
    ("T- Point Madipur cut", "Madipur cut/left side hotel reception", "http://122.176.125.150:1236/"),
    ("Action Balaji Hospital cut", "Permanent Police booth", "183.83.220.98"),
    ("Main Road in front of Metro pillar no 222", "Right side temple", "122.176.132.22"),
    ("Peeragarhi Chowk", "Booth under Peeragarhi Flyover", "103.163.63.220"),
    ("Infront of HP petrol pump, Meera Bagh", "Pollution Booth of HP petrol Pump", "183.83.220.101"),
    ("Bhairon Enclave Round About Near Hotel swift inn", "Under stairs of shikha Properties near hotel swift inn", "183.83.220.100"),
    ("Khanda Chowk near Chander Vihar Drain", "Permanent Police booth", "122.176.124.89"),
    ("Machchi Chowk near chander vihar Drain", "Corner shop of Ghodi Bagghi Shop", "124.123.18.246"),
    ("Infront of Electric pole at Billu Pani Wala office", "Inside Office of Billu Pani wala", "103.70.166.251"),
    ("In front of Bharat Petrol Pump", "Inside office of Bharat Petrol Pump", "WFL"),
    ("Pawan lala wali gali T point", "Inside optical shop", "103.70.164.224"),
    ("In Front of Vijay tailor", "Inside Vijay Tailor", "103.70.166.7"),
    ("KUNDU LCD Next Street to Vijay tailor", "In Mobile & speaker shop", "WFL"),
    ("Rani Khera Underpass", "In right side grocery store next to Dhaba", "183.83.223.35"),
    ("Geetanjali Enclave", "Live in PS", "103.165.29.7"),
    ("Towards kirari road near Railway crossing", "Inside Corner Medical shop", "183.83.220.110"),
    ("Dass Garden chowk near integrated Police booth", "Inside Corner Gym", "122.176.125.152"),
    ("", "", "http://103.159.43.122:82/"),
    ("", "", "http://103.159.43.122:83/"),
    ("", "", "http://103.159.43.123:82/"),
    ("", "", "http://103.159.43.123:86/"),
    ("", "", "http://103.159.43.123:87/"),
    ("", "", "http://103.134.114.84:80/"),
    ("", "", "http://103.134.114.84:81/"),
    ("", "", "http://103.134.114.84:82/"),
    ("", "", "http://49.205.174.29:80/"),
    ("", "", "http://49.205.174.29:81/"),
    ("", "", "http://183.83.221.190:80/"),
    ("", "", "http://183.83.221.190:81/"),
]

for row in data:
    ws.append(row)

wb.save("cameras.xlsx")
print(f"Created cameras.xlsx with {len(data)} rows")
