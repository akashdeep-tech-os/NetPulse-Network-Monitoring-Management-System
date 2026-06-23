import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import pandas as pd
import subprocess
import platform
from datetime import datetime
import pyperclip
import textwrap
import threading
import json
import os

# 🪟 Root Window
root = tk.Tk()
root.title("Rakshit Enterprises - Ping Monitor")
root.geometry("1200x650")

alert_on = tk.BooleanVar(value=True)
data = []
font_size = 12
row_height = 50  # 👈 Default row height

# 🧾 Treeview Style
style = ttk.Style()
style.configure("Custom.Treeview", rowheight=row_height, font=("Arial", font_size))
style.configure("Custom.Treeview.Heading", font=("Arial", font_size, "bold"))

# 🌐 Scrollable Frame
frame = tk.Frame(root)
frame.pack(fill=tk.BOTH, expand=True)

tree_scroll_y = tk.Scrollbar(frame, orient="vertical")
tree_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)

tree_scroll_x = tk.Scrollbar(frame, orient="horizontal")
tree_scroll_x.pack(side=tk.BOTTOM, fill=tk.X)

columns = ("#","Name","IP Address","Status")
tree = ttk.Treeview(frame, columns=columns, show="headings",
                    yscrollcommand=tree_scroll_y.set,
                    xscrollcommand=tree_scroll_x.set,
                    style="Custom.Treeview")

for col in columns:
    tree.heading(col, text=col)
    if col == "Name":
        tree.column(col, width=950, anchor="w")
    elif col == "#":
        tree.column(col, width=40, anchor="center")
    else:
        tree.column(col, width=220, anchor="center")

tree.pack(fill=tk.BOTH, expand=True)

tree_scroll_y.config(command=tree.yview)
tree_scroll_x.config(command=tree.xview)

# 📂 Load UI State Safely
def load_ui_state():
    try:
        if os.path.exists("ui_state.json"):
            with open("ui_state.json", "r") as f:
                ui_state = json.load(f)
            # ✅ Column widths
            for col, width in ui_state.get("columns", {}).items():
                if col in columns:
                    tree.column(col, width=width)
            # ✅ Window size
            if "window_size" in ui_state:
                root.geometry(ui_state["window_size"])
    except Exception as e:
        print(f"[Warning] UI state file corrupt or unreadable: {e}")

# 🖱️ Remove highlight when clicking outside
def clear_selection(event):
    tree.selection_remove(tree.selection())
tree.bind("<Button-1>", clear_selection)

# 🟢 Strong Ping Check
def ping(ip):
    try:
        if platform.system().lower() == "windows":
            output = subprocess.run(["ping", "-n", "1", "-w", "1000", ip],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        else:
            output = subprocess.run(["ping", "-c", "1", "-W", "1", ip],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        result = output.stdout.lower()
        if "ttl=" in result and "unreachable" not in result and "timed out" not in result:
            return True
        else:
            return False
    except Exception:
        return False

# 🧮 Update Table
def update_table():
    for item in tree.get_children():
        tree.delete(item)

    total_online = 0
    for idx, row in enumerate(data, start=1):
        status = "Online" if ping(row["IP"]) else "Offline"
        wrapped_name = "\n".join(textwrap.wrap(row["Name"], width=50))
        if status == "Online":
            total_online += 1
        tree.insert("", "end", values=(idx, wrapped_name, row["IP"], status),
                    tags=("online" if status == "Online" else "offline",))

    total_offline = len(data) - total_online
    lbl_count.config(text=f"Total: {len(data)} | Online: {total_online} | Offline: {total_offline}")

    tree.tag_configure("online", background="#c9f7c1", foreground="green")
    tree.tag_configure("offline", background="#f7c1c1", foreground="red")

def threaded_update_table():
    threading.Thread(target=update_table, daemon=True).start()

def auto_refresh():
    threaded_update_table()
    root.after(300000, auto_refresh)

# ➕ Add Entry
def add_entry():
    name = entry_name.get().strip()
    ip = entry_ip.get().strip()
    if name and ip:
        data.append({"Name": name, "IP": ip})
        entry_name.delete(0, tk.END)
        entry_ip.delete(0, tk.END)
        save_data()
        update_table()

# ✏️ Right Click ➝ Edit Menu
def show_context_menu(event):
    selected = tree.identify_row(event.y)
    if selected:
        tree.selection_set(selected)
        context_menu.post(event.x_root, event.y_root)

def edit_name():
    selected = tree.selection()
    if selected:
        idx = int(tree.item(selected[0], "values")[0]) - 1
        new_name = simple_input("Edit Name", "Enter new name:")
        if new_name:
            data[idx]["Name"] = new_name
            save_data()
            update_table()

def edit_ip():
    selected = tree.selection()
    if selected:
        idx = int(tree.item(selected[0], "values")[0]) - 1
        new_ip = simple_input("Edit IP", "Enter new IP:")
        if new_ip:
            data[idx]["IP"] = new_ip
            save_data()
            update_table()

def simple_input(title, prompt):
    popup = tk.Toplevel(root)
    popup.title(title)
    popup.geometry("300x120")
    tk.Label(popup, text=prompt).pack(pady=10)
    entry = tk.Entry(popup, width=25)
    entry.pack()
    entry.focus()

    result = {"value": None}
    def save_value():
        result["value"] = entry.get().strip()
        popup.destroy()
    tk.Button(popup, text="Save", command=save_value).pack(pady=10)
    popup.grab_set()
    root.wait_window(popup)
    return result["value"]

tree.bind("<Button-3>", show_context_menu)
context_menu = tk.Menu(root, tearoff=0)
context_menu.add_command(label="Edit Name", command=edit_name)
context_menu.add_command(label="Edit IP", command=edit_ip)

# Row select pe name/ip edit box me dikhaye
def on_row_select(event):
    selected = tree.selection()
    if selected:
        values = tree.item(selected[0], "values")
        entry_name.delete(0, tk.END)
        entry_name.insert(0, values[1])
        entry_ip.delete(0, tk.END)
        entry_ip.insert(0, values[2])
tree.bind("<<TreeviewSelect>>", on_row_select)

# 🖱️ Double click par IP copy to clipboard
def on_double_click(event):
    selected = tree.selection()
    if selected:
        values = tree.item(selected[0], "values")
        ip_address = values[2]
        pyperclip.copy(ip_address)
        messagebox.showinfo("Copied", f"📋 IP copied: {ip_address}")
tree.bind("<Double-1>", on_double_click)

# 🗑️ Delete Entry
def delete_entry():
    selected = tree.selection()
    if selected:
        confirm = messagebox.askyesno("Delete", "Are you sure you want to delete?")
        if confirm:
            idx = int(tree.item(selected[0], "values")[0]) - 1
            del data[idx]
            save_data()
            update_table()

# 🔍 Search
def search_entry(*args):
    query = search_var.get().strip().lower()
    for item in tree.get_children():
        tree.delete(item)
    for idx, row in enumerate(data, start=1):
        if query in row["Name"].lower() or query in row["IP"].lower():
            status = "Online" if ping(row["IP"]) else "Offline"
            wrapped_name = "\n".join(textwrap.wrap(row["Name"], width=50))
            tree.insert("", "end", values=(idx, wrapped_name, row["IP"], status),
                        tags=("online" if status == "Online" else "offline",))
    if not query:
        update_table()

# 📥 Import File
def import_file():
    file_path = filedialog.askopenfilename(filetypes=[("Excel files","*.xlsx"),("CSV files","*.csv")])
    if file_path:
        df = pd.read_excel(file_path) if file_path.endswith(".xlsx") else pd.read_csv(file_path)
        for _, row in df.iterrows():
            data.append({"Name": str(row["Name"]), "IP": str(row["IP"])})
        save_data()
        update_table()

# 📤 Export File
def export_file():
    file_path = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Excel","*.xlsx"),("CSV","*.csv")])
    if file_path:
        df = pd.DataFrame(data)
        if file_path.endswith(".xlsx"):
            df.to_excel(file_path, index=False)
        else:
            df.to_csv(file_path, index=False)

# 💾 Save Data
def save_data():
    df = pd.DataFrame(data)
    df.to_excel("saved_data.xlsx", index=False)

# 📂 Load Data
def load_data():
    if os.path.exists("saved_data.xlsx"):
        df = pd.read_excel("saved_data.xlsx")
        for _, row in df.iterrows():
            data.append({"Name": str(row["Name"]), "IP": str(row["IP"])})
        update_table()

# 🔔 Alert Toggle
def toggle_alert():
    alert_on.set(not alert_on.get())
    if alert_on.get():
        btn_alert.config(bg="green", fg="white")
    else:
        btn_alert.config(bg="SystemButtonFace", fg="black")

# 🧭 Zoom Row Height with Ctrl + Mouse Scroll
def on_mouse_scroll(event):
    global row_height
    if (event.state & 0x0004) != 0:  # Ctrl pressed
        if hasattr(event, "delta"):  # Windows
            direction = 1 if event.delta > 0 else -1
        else:  # Linux
            direction = 1 if event.num == 4 else -1
        row_height = max(20, min(100, row_height + direction * 5))
        style.configure("Custom.Treeview", rowheight=row_height)

tree.bind("<MouseWheel>", on_mouse_scroll)   # Windows
tree.bind("<Button-4>", on_mouse_scroll)     # Linux Scroll Up
tree.bind("<Button-5>", on_mouse_scroll)     # Linux Scroll Down

# 🧾 Controls Frame
control_frame = tk.Frame(root)
control_frame.pack(fill=tk.X, pady=5)

entry_name = tk.Entry(control_frame, width=20)
entry_name.pack(side=tk.LEFT, padx=5)
entry_name.insert(0, "Name")

entry_ip = tk.Entry(control_frame, width=20)
entry_ip.pack(side=tk.LEFT, padx=5)
entry_ip.insert(0, "IP Address")

tk.Button(control_frame, text="Add", command=add_entry).pack(side=tk.LEFT, padx=5)
tk.Button(control_frame, text="Delete", command=delete_entry).pack(side=tk.LEFT, padx=5)
tk.Button(control_frame, text="Import", command=import_file).pack(side=tk.LEFT, padx=5)
tk.Button(control_frame, text="Export", command=export_file).pack(side=tk.LEFT, padx=5)
tk.Button(control_frame, text="Check Ping", command=update_table).pack(side=tk.LEFT, padx=5)

search_var = tk.StringVar()
search_var.trace("w", search_entry)
search_entry_box = tk.Entry(control_frame, textvariable=search_var, width=25)
search_entry_box.pack(side=tk.LEFT, padx=5)
search_entry_box.insert(0, "Search...")

btn_alert = tk.Button(control_frame, text="Alert On/Off", command=toggle_alert)
btn_alert.pack(side=tk.LEFT, padx=5)
btn_alert.config(bg="green", fg="white")

# 🧮 Counter Label
lbl_count = tk.Label(root, text="Total: 0 | Online: 0 | Offline: 0", font=("Arial", 12, "bold"))
lbl_count.pack(pady=5)

# 📜 Footer
footer = tk.Label(root, text="© 2025 Rakshit Enterprises | All Rights Reserved", font=("Arial", 10))
footer.pack(side=tk.BOTTOM, pady=5)

# 💾 Save UI State on Close
def on_close():
    state = {"columns": {}, "window_size": root.geometry()}
    for col in columns:
        state["columns"][col] = tree.column(col)["width"]
    with open("ui_state.json", "w") as f:
        json.dump(state, f)
    root.destroy()

root.protocol("WM_DELETE_WINDOW", on_close)

# 🟢 Start
load_ui_state()
load_data()
auto_refresh()
root.mainloop()
