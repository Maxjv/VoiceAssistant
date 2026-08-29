import tkinter as tk
from tkinter import messagebox
import subprocess
import os

def kill_and_restart_tunnel():
    try:
        subprocess.run(["powershell", "-Command", "Stop-Process -Name 'cloudflared' -Force -ErrorAction SilentlyContinue"], creationflags=subprocess.CREATE_NO_WINDOW)
        messagebox.showinfo("Túnel Reiniciado", "Se ha cerrado el proceso de Cloudflare. El monitor en segundo plano generará uno nuevo automáticamente en unos segundos.")
    except Exception as e:
        messagebox.showerror("Error", f"Fallo al reiniciar el túnel: {e}")

def restart_assistant():
    try:
        # Matar todos los procesos críticos
        subprocess.run(["powershell", "-Command", "Stop-Process -Name 'VoiceAssistant_TFTE', 'node', 'cloudflared' -Force -ErrorAction SilentlyContinue"], creationflags=subprocess.CREATE_NO_WINDOW)
        
        # Invocar nuevamente el watchdog.ps1
        root_dir = os.path.dirname(os.path.abspath(__file__))
        watchdog = os.path.join(root_dir, "watchdog.ps1")
        if os.path.exists(watchdog):
            subprocess.Popen(["powershell", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", watchdog], creationflags=subprocess.CREATE_NO_WINDOW)
            messagebox.showinfo("Asistente Reiniciado", "Todos los procesos han sido cerrados y el Asistente Local ha comenzado a arrancar nuevamente de forma limpia.")
        else:
            messagebox.showerror("Error", f"No se encontró el archivo de arranque: {watchdog}")
    except Exception as e:
        messagebox.showerror("Error", f"Fallo al reiniciar el asistente: {e}")

# Configuración de la Ventana Principal
root = tk.Tk()
root.title("TFTE Rescue")
root.geometry("350x220")
root.configure(bg="#0f172a") # Fondo oscuro premium
root.resizable(False, False)

# Centrar ventana en pantalla
window_width = 350
window_height = 220
screen_width = root.winfo_screenwidth()
screen_height = root.winfo_screenheight()
center_x = int(screen_width/2 - window_width / 2)
center_y = int(screen_height/2 - window_height / 2)
root.geometry(f'{window_width}x{window_height}+{center_x}+{center_y}')

# Título
title_label = tk.Label(root, text="Panel de Rescate a Prueba de Fallos", font=("Segoe UI", 12, "bold"), bg="#0f172a", fg="#38bdf8")
title_label.pack(pady=(20, 15))

# Botones
btn_tunnel = tk.Button(root, text="Generar New VA Url", font=("Segoe UI", 11, "bold"), bg="#334155", fg="white", activebackground="#475569", activeforeground="white", relief="flat", cursor="hand2", command=kill_and_restart_tunnel)
btn_tunnel.pack(fill="x", padx=40, pady=8, ipady=5)

btn_assistant = tk.Button(root, text="Reiniciar Asistente Local", font=("Segoe UI", 11, "bold"), bg="#ef4444", fg="white", activebackground="#f87171", activeforeground="white", relief="flat", cursor="hand2", command=restart_assistant)
btn_assistant.pack(fill="x", padx=40, pady=8, ipady=5)

root.mainloop()
