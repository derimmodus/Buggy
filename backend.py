import os

# Dummy-Funktion für Kompatibilität
import json
import time
import traceback
import subprocess
import sys
import requests
import socket
import webbrowser
# These imports are commented out but kept for reference
# import re  # Used in network ping regex matching
# import shutil  # Used in network copy_program function
import glob  # Used in find_install_program function

import traceback  # Used for detailed error logging

# Temporarily comment out to avoid import errors
# from network_endpoints import register_network_endpoints




# Set up path for libraries with priority order
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_DIR = os.path.join(BASE_DIR, 'lib')
OFFLINE_LIB_DIR = os.path.join(BASE_DIR, 'offline_lib')

# Add paths to sys.path in priority order
for path in [LIB_DIR, OFFLINE_LIB_DIR]:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

# Create fake _strptime module for pylance static analysis
if not os.path.exists(os.path.join(BASE_DIR, '_strptime.py')):
    with open(os.path.join(BASE_DIR, '_strptime.py'), 'w') as f:
        f.write("""
# Fake _strptime module for static analysis
class _TimeRE:
    def __init__(self, locale_time=None):
        self.locale_time = locale_time or object()

_cache_lock = object()
_regex_cache = {}
_CACHE_MAX_SIZE = 100
""")

# Setup for PIL/Pillow
try:
    # Try to import Pillow - using conditional imports for IDE static analysis
    PIL_AVAILABLE = False
    if os.path.exists(os.path.join(LIB_DIR, 'PIL')):
        from PIL import Image, ImageDraw  # type: ignore
        PIL_AVAILABLE = True
        print("Successfully imported PIL from lib directory")
    elif os.path.exists(os.path.join(OFFLINE_LIB_DIR, 'pillow_temp')):
        pil_path = os.path.join(OFFLINE_LIB_DIR, 'pillow_temp')
        if pil_path not in sys.path:
            sys.path.insert(0, pil_path)
        from PIL import Image, ImageDraw  # type: ignore
        PIL_AVAILABLE = True
        print("Successfully imported PIL from pillow_temp directory")
    else:
        # Try to find and extract PIL from wheel if available
        wheel_files = glob.glob(os.path.join(OFFLINE_LIB_DIR, "pillow*.whl"))
        if wheel_files:
            import zipfile
            temp_dir = os.path.join(OFFLINE_LIB_DIR, 'pillow_temp')
            os.makedirs(temp_dir, exist_ok=True)
            with zipfile.ZipFile(wheel_files[0], 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            if temp_dir not in sys.path:
                sys.path.insert(0, temp_dir)
            from PIL import Image, ImageDraw  # type: ignore
            PIL_AVAILABLE = True
            print(f"Successfully imported PIL from extracted wheel {wheel_files[0]}")
        else:
            print("PIL/Pillow library not available. Some icon features will be limited.")
except ImportError as e:
    print(f"Error importing PIL: {e}")
    PIL_AVAILABLE = False
    # Create stub classes for static analysis only
    class Image:
        class Image:
            def __init__(self, *args, **kwargs): pass
            def save(self, *args, **kwargs): pass
        @staticmethod
        def new(*args, **kwargs): return Image.Image()
    class ImageDraw:
        @staticmethod
        def Draw(*args, **kwargs): return object()
    print("Using PIL stub classes for static analysis only")

# Set window title (only on Windows hosts)
try:
    if os.name == 'nt':
        os.system("title HelpTool Backend")
except Exception:
    pass

# Flask import with fallback
OFFLINE_MODE = False
try:
    from flask import Flask, jsonify, request, send_from_directory, send_file, abort
    from werkzeug.utils import secure_filename
    from flask_cors import CORS  # type: ignore
    print("Flask erfolgreich importiert.")
except ImportError as e:
    print(f"Fehler beim Importieren von Flask: {e}")
    print("Starte im Offline-Modus mit eingeschränkter Funktionalität...")
    OFFLINE_MODE = True
    # Create Flask stubs for static analysis
    class Flask:
        def __init__(self, *args, **kwargs): pass
        def route(self, *args, **kwargs): return lambda x: x
    def jsonify(*args, **kwargs): return {}
    class request:
        method = "GET"
        data = b""
        args = {}
        files = {}
        @staticmethod
        def get_json(*args, **kwargs): return {}
    def send_from_directory(*args, **kwargs): return ""
    def send_file(*args, **kwargs): return ""
    def abort(*args, **kwargs): pass
    def secure_filename(*args, **kwargs): return ""
    class CORS:
        def __init__(self, *args, **kwargs): pass

# Hilfsfunktion für Zeitstempel (ersetzt datetime.now().isoformat())
def get_timestamp_iso():
    """Gibt den aktuellen Zeitstempel im ISO-Format zurück"""
    return time.strftime('%Y-%m-%dT%H:%M:%S.000Z')

def parse_iso_timestamp(timestamp_str):
    """Konvertiert einen ISO-Zeitstempel zu einem Unix-Timestamp"""
    try:
        return time.mktime(time.strptime(timestamp_str.split('.')[0], '%Y-%m-%dT%H:%M:%S'))
    except Exception:
        return 0

# Datei-Upload-Konfiguration
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB

def allowed_file(filename):
    """Prüft, ob die Dateiendung erlaubt ist"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Bestimme den Basis-Pfad der Anwendung dynamisch
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Globale Variablen mit dynamischem Pfad
DATA_DIR = os.path.join(BASE_DIR, 'data')
LOG_PATH = os.path.join(BASE_DIR, "logs", "program-starts.json")
SHORTCUTS_DIR = os.path.join(BASE_DIR, "shortcuts")
WORKSPACES_BASE_DIR = os.path.join(SHORTCUTS_DIR, 'workspaces')

# Stelle sicher, dass die benötigten Ordner existieren
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
os.makedirs(SHORTCUTS_DIR, exist_ok=True)
os.makedirs(WORKSPACES_BASE_DIR, exist_ok=True)

# Logge die Tool-Nutzung
def log_tool_usage(tool):
    """Protokolliert die Nutzung eines Tools in der Log-Datei."""
    log_file = os.path.join(DATA_DIR, 'tool_usage_log.json')
    
    try:
        # Lade existierende Log-Einträge
        entries = []
        if os.path.exists(log_file):
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    entries = json.load(f)
            except json.JSONDecodeError:
                # Wenn die JSON-Datei beschädigt ist, starte mit einer leeren Liste
                entries = []
        
        # Füge neuen Eintrag hinzu
        entries.append({
            "timestamp": get_timestamp_iso(),
            "tool_id": tool.get('id'),
            "tool_name": tool.get('name', 'Unbekanntes Tool'),
            "tool_path": tool.get('path', '')
        })
        
        # Speichere aktualisierte Log-Einträge (maximal die letzten 1000 Einträge)
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(entries[-1000:], f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        print(f"Fehler beim Loggen der Tool-Nutzung: {e}")

# Funktion zum Erstellen einer Verknüpfung (LNK-Datei)
def create_shortcut(target_path, shortcut_name):
    """
    Erstellt eine plattformübergreifende "Verknüpfung" für den gegebenen Pfad.
    In Docker/Linux-Umgebung wird eine Textdatei mit Tool-Informationen erstellt.

    Args:
        target_path (str): Vollständiger Pfad zum Zielprogramm
        shortcut_name (str): Name der Verknüpfung (ohne .lnk)

    Returns:
        str: Pfad zur erstellten Verknüpfung oder None bei Fehler
    """
    try:
        # Sicherstellen, dass der Dateiname gültig ist und .lnk-Erweiterung hat
        safe_name = "".join(c for c in shortcut_name if c.isalnum() or c in " -_()[]").strip()
        if not safe_name:
            safe_name = "Programm"

        # Vollständiger Pfad für die Verknüpfung
        shortcut_path = os.path.join(SHORTCUTS_DIR, f"{safe_name}.lnk")

        # Erstelle eine Textdatei mit Tool-Informationen (plattformübergreifend)
        shortcut_content = f"""# HelpTool Workspace Tool
# Dies ist eine plattformübergreifende Tool-Verknüpfung
# Erstellt am: {time.strftime('%Y-%m-%d %H:%M:%S')}
TARGET_PATH={target_path}
TOOL_NAME={shortcut_name}
"""

        with open(shortcut_path, "w", encoding="utf-8") as f:
            f.write(shortcut_content)

        if os.path.exists(shortcut_path):
            print(f"Verknüpfung erstellt: {shortcut_path}")
            return shortcut_path
        else:
            print("Fehler: Verknüpfung konnte nicht erstellt werden")
            return None

    except Exception as e:
        print(f"Fehler beim Erstellen der Verknüpfung: {e}")
        return None


def create_shortcut_at(target_path, shortcut_name, dest_folder):
    """
    Create a cross-platform "shortcut" at a specific destination folder.
    In Docker/Linux environment, creates a text file with tool information.
    """
    try:
        safe_name = "".join(c for c in shortcut_name if c.isalnum() or c in " -_()[]").strip()
        if not safe_name:
            safe_name = "Programm"

        os.makedirs(dest_folder, exist_ok=True)
        shortcut_path = os.path.join(dest_folder, f"{safe_name}.lnk")

        # Create a text file with tool information (cross-platform)
        shortcut_content = f"""# HelpTool Workspace Tool
# This is a cross-platform tool shortcut
# Created at: {time.strftime('%Y-%m-%d %H:%M:%S')}
TARGET_PATH={target_path}
TOOL_NAME={shortcut_name}
"""

        with open(shortcut_path, "w", encoding="utf-8") as f:
            f.write(shortcut_content)

        if os.path.exists(shortcut_path):
            print(f"Verknüpfung erstellt in Zielordner: {shortcut_path}")
            return shortcut_path
        return None
    except Exception as e:
        print(f"Fehler beim Erstellen der Verknüpfung in Zielordner {dest_folder}: {e}")
        return None

# Hilfsfunktionen für Dateizugriff
def load_json(name):
    """Lädt oder initialisiert ein JSON-Modul."""
    path = os.path.join(DATA_DIR, f"{name}.json")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        save_json(name, [])
        return []

def save_json(name, data):
    """Speichert ein Python-Objekt als JSON."""
    path = os.path.join(DATA_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Offline-Modus: Minimalserver bei Flask-Import-Fehler
if OFFLINE_MODE:
    def run_offline_server():
        """Minimalserver für USB-Stick und Offline-Betrieb ohne Flask."""
        FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
        HOST = '127.0.0.1'
        PORT = 5411
        
        print("HelpTool wird im Offline-Modus gestartet...")
        print(f"Basis-Pfad: {BASE_DIR}")
        print(f"Frontend-Pfad: {FRONTEND_DIR}")
        print(f"Daten-Pfad: {DATA_DIR}")
        print("Webinterface verfügbar unter: http://127.0.0.1:5411")
        
        # Öffne den Browser automatisch
        os.system(f'start http://{HOST}:{PORT}')
        
        # Socket erstellen
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server_socket.bind((HOST, PORT))
            server_socket.listen(5)
            print(f"Server läuft auf Port {PORT}")
            
            while True:
                client_conn, client_addr = server_socket.accept()
                request = client_conn.recv(4096)
                
                # Sehr einfache Anfrageverarbeitung
                request_line = request.split(b'\r\n')[0].decode('utf-8')
                
                try:
                    method, path, _ = request_line.split(' ', 2)
                except ValueError:
                    client_conn.close()
                    continue
                
                print(f"Anfrage: {method} {path}")
                
                # API-Anfragen simulieren für JSON-Daten
                if path.startswith('/api/'):
                    # WICHTIG: Spezielle API-Endpunkte ZUERST behandeln!
                    
                    # Spezielle API-Endpunkte für Tool-Start
                    if path == '/api/start-tool' and method == 'POST':
                        try:
                            # Bodydaten extrahieren
                            body_start = request.find(b'\r\n\r\n') + 4
                            body_data = request[body_start:].decode('utf-8')
                            
                            # JSON-Body deserialisieren
                            data = json.loads(body_data)
                            tool_id = data.get('id')
                            use_shortcut = data.get('use_shortcut', False)
                            
                            print(f"Tool-Start-Anfrage: ID={tool_id}, use_shortcut={use_shortcut}")
                            
                            if not tool_id:
                                response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps({"error": "Keine Tool-ID angegeben"}).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            
                            # Tools laden
                            tools = load_json('tools')
                            print(f"Geladene Tools: {len(tools)} gefunden")
                            for t in tools:
                                print(f"  Tool: ID={t.get('id')}, Name={t.get('name')}")
                            
                            tool = next((t for t in tools if t.get('id') == tool_id), None)
                            
                            if not tool:
                                print(f"Tool mit ID {tool_id} nicht gefunden. Verfügbare Tools:")
                                for t in tools:
                                    print(f"  - ID: {t.get('id')}, Name: {t.get('name')}")
                                response = "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps({"error": f"Tool mit ID {tool_id} nicht gefunden"}).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            
                            # Tool starten
                            tool_path = tool.get('path', '')
                            tool_name = tool.get('name', 'Unbekanntes Tool')
                            is_admin = tool.get('admin', False)
                            tool_type = tool.get('type', 'executable')
                            browser_choice = tool.get('browser', 'default')
                            
                            if not tool_path:
                                response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps({"error": "Tool hat keinen gültigen Pfad"}).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            
                            try:
                                # Tool starten - verbesserte Version mit Vordergrund und Netzwerk-Support
                                launch_successful = False
                                start_mode = ""
                                
                                # Prüfen ob es sich um einen URL/Link handelt
                                is_url = tool_type == 'link' or tool_path.startswith(('http://', 'https://', 'ftp://'))
                                # Prüfen ob es sich um einen Netzwerkpfad handelt
                                is_network = tool_type == 'network' or tool_path.startswith(('\\\\', '//'))
                                
                                if is_url:
                                    # URL in Browser öffnen
                                    print(f"Öffne URL {tool_path}")
                                    subprocess.Popen(f'start "{tool_path}"', shell=True)
                                    launch_successful = True
                                    start_mode = "Browser"
                                elif is_network:
                                    # Netzwerkpfad öffnen
                                    print(f"Öffne Netzwerkpfad {tool_path}")
                                    if is_admin:
                                        # Admin-Start für Netzwerkpfad
                                        admin_command = f'Start-Process -FilePath "explorer.exe" -ArgumentList "{tool_path}" -Verb RunAs -WindowStyle Normal'
                                        subprocess.Popen(['powershell', '-Command', admin_command])
                                        start_mode = "Netzwerk (Administrator)"
                                    else:
                                        # Normaler Netzwerkpfad-Start
                                        subprocess.Popen(f'explorer.exe "{tool_path}"', shell=True)
                                        start_mode = "Netzwerk"
                                    launch_successful = True
                                elif is_admin:
                                    # Admin-Start für Programme - verbessert
                                    print(f"Admin-Start für {tool_name}: {tool_path}")
                                    admin_command = f'Start-Process -FilePath "{tool_path}" -Verb RunAs -WindowStyle Normal'
                                    result = subprocess.Popen(['powershell', '-Command', admin_command])
                                    launch_successful = True
                                    start_mode = "Administrator"
                                else:
                                    # Normaler Start - verbessert mit Vordergrund
                                    print(f"Normaler Start für {tool_name}: {tool_path}")
                                    
                                    # Für .exe Dateien: direkter Start mit Vordergrund-Fokus
                                    if tool_path.lower().endswith('.exe') or '\\' in tool_path:
                                        # PowerShell für bessere Kontrolle und Vordergrund
                                        ps_command = f'Start-Process -FilePath "{tool_path}" -WindowStyle Normal'
                                        subprocess.Popen(['powershell', '-Command', ps_command])
                                    else:
                                        # Für andere Dateien: Standard-Start
                                        subprocess.Popen(f'start "" "{tool_path}"', shell=True)
                                    
                                    launch_successful = True
                                    start_mode = "Normal"
                                
                                if launch_successful:
                                    result = {
                                        "success": True,
                                        "message": f"Tool '{tool_name}' erfolgreich gestartet ({start_mode})",
                                        "tool_name": tool_name,
                                        "start_mode": start_mode,
                                        "admin": is_admin
                                    }
                                    print(f"Tool '{tool_name}' erfolgreich gestartet")
                                else:
                                    result = {
                                        "success": False,
                                        "error": "Tool konnte nicht gestartet werden"
                                    }
                                
                                response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps(result).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                                
                            except Exception as start_error:
                                error_msg = f"Fehler beim Starten von '{tool_name}': {str(start_error)}"
                                print(error_msg)
                                result = {
                                    "success": False,
                                    "error": error_msg
                                }
                                response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps(result).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            
                        except Exception as e:
                            error_msg = f"Fehler bei start-tool API: {str(e)}"
                            print(error_msg)
                            response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n".encode()
                            response += json.dumps({"error": error_msg}).encode()
                            client_conn.sendall(response)
                            client_conn.close()
                            continue
                    
                    # Spezialfall für Datei-Browser
                    if path.startswith('/api/file-browser') or path.startswith('/api/file-browser-simple'):
                        try:
                            # Temporären Skriptpfad erstellen
                            script_path = os.path.join(BASE_DIR, f'file_picker_{time.time()}.ps1')
                            
                            # PowerShell-Skript mit verbesserter Sichtbarkeit
                            ps_code = r"""
                            Add-Type -AssemblyName System.Windows.Forms
                            
                            # Importiere den notwendigen Namespace für Fensteroperationen
                            Add-Type @"
                            using System;
                            using System.Runtime.InteropServices;
                            
                            public class WindowHelper {
                                [DllImport("user32.dll")]
                                [return: MarshalAs(UnmanagedType.Bool)]
                                public static extern bool SetForegroundWindow(IntPtr hWnd);
                                
                                [DllImport("user32.dll")]
                                public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                                
                                [DllImport("user32.dll")]
                                public static extern IntPtr GetActiveWindow();
                            }
"@
                            
                            # Forciere die Anwendung in den Vordergrund
                            [System.Windows.Forms.Application]::EnableVisualStyles()
                            [System.Windows.Forms.Application]::DoEvents()
                            
                            # Erstelle ein temporäres Formular, das garantiert im Vordergrund ist
                            $form = New-Object System.Windows.Forms.Form
                            $form.TopMost = $true
                            $form.Opacity = 0
                            $form.ShowInTaskbar = $false
                            $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
                            $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
                            $form.Show()
                            $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
                            
                            # Bringe PowerShell-Fenster in den Vordergrund
                            $currentWindowHandle = [WindowHelper]::GetActiveWindow()
                            [WindowHelper]::SetForegroundWindow($currentWindowHandle)
                            [WindowHelper]::ShowWindow($currentWindowHandle, 5)  # 5 = SW_SHOW
                            
                            # Dialoge mit forciertem Vordergrund erstellen
                            $dialog = New-Object System.Windows.Forms.OpenFileDialog
                            $dialog.Filter = "Programme (*.exe)|*.exe|Verknüpfungen (*.lnk)|*.lnk|Alle Dateien (*.*)|*.*"
                            $dialog.Title = "Programm auswählen (HelpTool)"
                            $dialog.CheckFileExists = $true
                            
                            # Gib dem System Zeit, das Fenster anzuzeigen
                            Start-Sleep -Milliseconds 500
                            [System.Windows.Forms.Application]::DoEvents()
                            
                            # Dialog anzeigen und sicherstellen, dass er im Vordergrund ist
                            $result = $dialog.ShowDialog($form)
                            
                            # Bereinige das temporäre Formular
                            $form.Close()
                            
                            if ($result -eq 'OK') {
                                $path = $dialog.FileName
                                $name = [System.IO.Path]::GetFileNameWithoutExtension($path)
                                $extension = [System.IO.Path]::GetExtension($path)
                                $isShortcut = $extension -eq ".lnk"
                                $target = $null

                                if ($isShortcut) {
                                    try {
                                        $shell = New-Object -ComObject WScript.Shell
                                        $shortcut = $shell.CreateShortcut($path)
                                        $target = $shortcut.TargetPath
                                    } catch {}
                                }

                                $result = @{
                                    status = "completed"
                                    data = @{
                                        path = $path
                                        name = $name
                                        extension = $extension
                                        is_shortcut = $isShortcut
                                        target = $target
                                    }
                                }

                                $result | ConvertTo-Json -Depth 3
                            } else {
                                @{ status = "cancelled" } | ConvertTo-Json
                            }
                            """
                            
                            # Skript temporär speichern
                            with open(script_path, 'w', encoding='utf-8') as f:
                                f.write(ps_code)
                            
                            # PowerShell ausführen
                            result = subprocess.run(
                                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Normal", "-File", script_path],
                                capture_output=True,
                                text=True
                            )
                            
                            # Aufräumen
                            try:
                                os.remove(script_path)
                            except Exception:
                                pass
                            
                            if result.returncode == 0:
                                stdout = result.stdout.strip()
                                if stdout:
                                    response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                    response += stdout.encode('utf-8')
                                    client_conn.sendall(response)
                                    client_conn.close()
                                    continue
                                else:
                                    response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                    response += json.dumps({"status": "cancelled"}).encode('utf-8')
                                    client_conn.sendall(response)
                                    client_conn.close()
                                    continue
                            else:
                                error = result.stderr.strip() or "Unbekannter Fehler"
                                print(f"PowerShell Fehler: {error}")
                                response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps({"status": "error", "error": error}).encode('utf-8')
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                        except Exception as e:
                            print(f"Fehler im Dateibrowser: {e}")
                            response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                            response += json.dumps({"status": "error", "error": str(e)}).encode('utf-8')
                            client_conn.sendall(response)
                            client_conn.close()
                            continue
                        
                    parts = path.split('/')
                    if len(parts) >= 3:
                        module = parts[2]
                        
                        # PUT und DELETE für einzelne Elemente
                        if len(parts) >= 4 and parts[3].isdigit():
                            item_id = int(parts[3])  # Konvertiere immer zu int 
                            
                            if method == 'DELETE':
                                items = load_json(module)
                                idx = next((i for i, it in enumerate(items) if it.get('id') == item_id), None)
                                if idx is not None:
                                    items.pop(idx)
                                    save_json(module, items)
                                    response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                    response += json.dumps({"success": True}).encode()
                                    client_conn.sendall(response)
                                    client_conn.close()
                                    continue
                            
                            elif method == 'PUT' and b'Content-Length:' in request:
                                # Bodydaten extrahieren
                                body_start = request.find(b'\r\n\r\n') + 4
                                body_data = request[body_start:]
                                
                                try:
                                    # Validiere die erhaltenen Daten
                                    if not body_data:
                                        print(f"PUT {module}/{item_id}: Leerer Request-Body")
                                        response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n".encode()
                                        response += json.dumps({"error": "Leerer Request-Body"}).encode()
                                        client_conn.sendall(response)
                                        client_conn.close()
                                        continue
                                    
                                    # Stellen Sie sicher, dass gültiges JSON gesendet wurde
                                    try:
                                        updated_item = json.loads(body_data)
                                        if not updated_item:
                                            raise ValueError("Leeres JSON-Objekt erhalten")
                                    except json.JSONDecodeError as jde:
                                        print(f"PUT {module}/{item_id}: Ungültiges JSON im Request-Body: {str(jde)}")
                                        print(f"Erhaltene Daten: {body_data}")
                                        response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n".encode()
                                        response += json.dumps({"error": "Ungültiges JSON im Request-Body"}).encode()
                                        client_conn.sendall(response)
                                        client_conn.close()
                                        continue
                                    
                                    items = load_json(module)
                                    
                                    # Ausführliches Logging
                                    print(f"PUT {module}/{item_id}: Aktualisiere Eintrag mit: {json.dumps(updated_item)}")
                                    
                                    # Immer die numerische ID verwenden
                                    idx = next((i for i, it in enumerate(items) if it.get('id') == item_id), None)
                                    if idx is None:
                                        response = "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n".encode()
                                        response += json.dumps({"error": f"Eintrag mit ID {item_id} nicht gefunden"}).encode()
                                        client_conn.sendall(response)
                                        client_conn.close()
                                        continue
                                    
                                    # ID beibehalten
                                    updated_item['id'] = item_id
                                    
                                    # Debugging-Ausgabe vor dem Update
                                    print(f"Aktualisiere {module}/{item_id}: Altes Element: {json.dumps(items[idx])}")
                                    print(f"Aktualisiere {module}/{item_id}: Neues Element: {json.dumps(updated_item)}")
                                    
                                    # Aktualisiere das Element
                                    items[idx] = updated_item
                                    save_json(module, items)
                                    
                                    # Erfolgsmeldung
                                    print(f"PUT {module}/{item_id}: Eintrag erfolgreich aktualisiert")
                                    
                                    response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                    response += json.dumps(updated_item).encode()
                                    client_conn.sendall(response)
                                    client_conn.close()
                                    continue
                                except Exception as e:
                                    error_msg = f"Fehler bei PUT-Anfrage für {module}/{item_id}: {str(e)}"
                                    print(error_msg)
                                    error_log = os.path.join(BASE_DIR, 'error.log')
                                    with open(error_log, 'a', encoding='utf-8') as f:
                                        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
                                    
                                    response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n".encode()
                                    response += json.dumps({"error": error_msg}).encode()
                                    client_conn.sendall(response)
                                    client_conn.close()
                                    continue
                        
                        # GET und POST für Listen
                        if method == 'GET':
                            json_path = os.path.join(DATA_DIR, f"{module}.json")
                            content_type = 'application/json'
                            
                            try:
                                if os.path.exists(json_path):
                                    with open(json_path, 'rb') as f:
                                        content = f.read()
                                else:
                                    content = b"[]"  # Leeres JSON-Array zurückgeben
                                    
                                response = f"HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\n\r\n".encode()
                                response += content
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            except Exception as e:
                                print(f"API-GET-Fehler: {e}")
                                content = b"[]"
                        
                        elif method == 'POST' and b'Content-Length:' in request:
                            # Bodydaten extrahieren
                            body_start = request.find(b'\r\n\r\n') + 4
                            body_data = request[body_start:]
                            
                            try:
                                # JSON-Body deserialisieren
                                new_item = json.loads(body_data)
                                items = load_json(module)
                                
                                # Ausführliches Logging
                                print(f"POST {module}: Neuer Eintrag wird erstellt: {json.dumps(new_item)}")
                                
                                # Wenn es sich um Tools handelt, prüfe auf Duplikate basierend auf dem Pfad
                                if module == 'tools' and 'path' in new_item:
                                    # Prüfe, ob bereits ein Tool mit diesem Pfad existiert
                                    existing_tool = next((t for t in items if t.get('path') == new_item.get('path')), None)
                                    if existing_tool:
                                        print(f"POST tools: Tool mit Pfad {new_item.get('path')} existiert bereits mit ID {existing_tool.get('id')}")
                                        
                                        # Aktualisiere das bestehende Tool anstatt ein neues zu erstellen
                                        for key, value in new_item.items():
                                            if key != 'id':  # ID nicht überschreiben
                                                existing_tool[key] = value
                                        
                                        # Speichere die aktualisierte Liste
                                        save_json(module, items)
                                        
                                        response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n".encode()
                                        response += json.dumps(existing_tool).encode()
                                        client_conn.sendall(response)
                                        client_conn.close()
                                        continue
                                
                                # Generiere eine eindeutige ID für das neue Element
                                if module == 'tools':
                                    # Stelle sicher, dass wir lückenlose IDs haben (1, 2, 3, ...)
                                    existing_ids = [item.get('id', 0) for item in items if isinstance(item.get('id'), (int, float))]
                                    next_id = 1
                                    while next_id in existing_ids:
                                        next_id += 1
                                    new_item['id'] = next_id
                                else:
                                    # Für andere Module verwenden wir die bestehende Methode
                                    new_item['id'] = max((i.get('id', 0) for i in items), default=0) + 1
                                
                                # Timestamps hinzufügen
                                if 'created_at' not in new_item:
                                    new_item['created_at'] = get_timestamp_iso()
                                
                                # Standardwerte für Tools setzen
                                if module == 'tools':
                                    if 'admin' not in new_item:
                                        new_item['admin'] = False
                                    if 'autostart' not in new_item:
                                        new_item['autostart'] = False
                                    if 'tags' not in new_item:
                                        new_item['tags'] = []
                                    if 'favorite' not in new_item:
                                        new_item['favorite'] = False
                                
                                # Element zur Liste hinzufügen und speichern
                                items.append(new_item)
                                save_json(module, items)
                                
                                print(f"POST {module}: Eintrag erfolgreich erstellt mit ID {new_item.get('id')}")
                                
                                response = "HTTP/1.1 201 Created\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps(new_item).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                            except Exception as e:
                                error_msg = f"Fehler bei POST-Anfrage: {str(e)}"
                                print(error_msg)
                                error_log = os.path.join(BASE_DIR, 'error.log')
                                with open(error_log, 'a', encoding='utf-8') as f:
                                    f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
                                
                                response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n".encode()
                                response += json.dumps({"error": error_msg}).encode()
                                client_conn.sendall(response)
                                client_conn.close()
                                continue
                
                # WICHTIG: API-Anfragen hier abfangen, keine Dateien mit API-Pfaden suchen
                # Wenn wir hier ankommen, bedeutet es, dass die API-Anfrage nicht verarbeitet wurde
                if path.startswith('/api/'):
                    response = "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n".encode()
                    response += json.dumps({"error": "API-Endpunkt nicht gefunden"}).encode('utf-8')
                    client_conn.sendall(response)
                    client_conn.close()
                    continue
                
                # Standardpfad auf index.html umleiten
                if path == '/':
                    path = '/index.html'
                
                # Dateipfad bestimmen
                file_path = os.path.join(FRONTEND_DIR, path.lstrip('/'))
                
                # Datei lesen
                content = None
                content_type = 'text/html'
                
                if path.endswith('.html'):
                    content_type = 'text/html'
                elif path.endswith('.js'):
                    content_type = 'application/javascript'
                elif path.endswith('.css'):
                    content_type = 'text/css'
                elif path.endswith('.json'):
                    content_type = 'application/json'
                elif path.endswith('.png'):
                    content_type = 'image/png'
                elif path.endswith('.jpg') or path.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif path.endswith('.svg'):
                    content_type = 'image/svg+xml'
                
                try:
                    with open(file_path, 'rb') as f:
                        content = f.read()
                except Exception as e:
                    print(f"Dateifehler: {e}")
                    # Fallback auf index.html
                    try:
                        with open(os.path.join(FRONTEND_DIR, 'index.html'), 'rb') as f:
                            content = f.read()
                    except Exception as e:
                        print(f"Fallback-Fehler: {e}")
                        content = """
                        <html>
                        <head>
                            <title>HelpTool Offline-Modus</title>
                            <style>
                                body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; background: #f0f0f0; color: #333; }
                                h1 { color: #2196F3; }
                                .container { background: #fff; padding: 20px; border-radius: 4px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>HelpTool Offline-Modus</h1>
                                <p>Das HelpTool läuft im minimalen Offline-Modus ohne Flask.</p>
                                <p>Funktionen wie Dateibrowser und Netzwerkscans sind eingeschränkt.</p>
                            </div>
                        </body>
                        </html>
                        """.encode('utf-8')
                
                # HTTP-Antwort senden
                response = f"HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\n\r\n".encode()
                response += content
                
                client_conn.sendall(response)
                client_conn.close()
        
        except KeyboardInterrupt:
            print("Server wird durch Benutzer beendet...")
        except Exception as e:
            print(f"Serverfehler: {e}")
        finally:
            server_socket.close()
            print("Server wurde beendet.")
    
    # Offline-Modus starten, wenn Flask nicht verfügbar ist
    if __name__ == '__main__':
        run_offline_server()
        sys.exit(0)
else:
    # Online-Modus mit Flask
    # App initialisieren mit dynamischem Pfad
    app = Flask(__name__, 
        static_folder=os.path.join(BASE_DIR, 'frontend'),
        static_url_path=''
    )
    
    # Erlaubt größere Datei-Uploads (bis zu 5MB)
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    
    # Konfiguration für CORS (Cross-Origin Resource Sharing)
    CORS(app)

    # Register network endpoints from the network_endpoints module
    # register_network_endpoints(app)  # Temporarily commented out

    # FAQ-Anhänge Verzeichnis
    FAQ_ATTACHMENTS_DIR = os.path.join(DATA_DIR, 'faq_attachments')
    os.makedirs(FAQ_ATTACHMENTS_DIR, exist_ok=True)

    @app.route('/')
    def index():
        """Startseite: liefert das Frontend aus."""
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/api/<module>', methods=['GET', 'POST'])
    def module_list(module):
        """GET: Liste aller Einträge; POST: neuen Eintrag anlegen."""
        if module == 'workspace-import':
            if request.method == 'POST':
                return api_workspace_import()
            return jsonify({"error": "Methode nicht erlaubt"}), 405

        if module == 'workspace-tools':
            if request.method == 'GET':
                return api_get_workspace_tools()
            return jsonify({"error": "Methode nicht erlaubt"}), 405

        items = load_json(module)
        
        if request.method == 'GET':
            return jsonify(items)
        
        # POST-Anfrage für neuen Eintrag
        try:
            # Validiere, dass gültige JSON-Daten gesendet wurden
            if not request.data:
                print(f"POST {module}: Leerer Request-Body")
                return jsonify({"error": "Leerer Request-Body"}), 400
                
            new_item = request.get_json()
            if new_item is None:
                print(f"POST {module}: Ungültiges JSON im Request-Body")
                return jsonify({"error": "Ungültiges JSON im Request-Body"}), 400
            
            # Ausführliches Logging
            print(f"POST {module}: Neuer Eintrag wird erstellt: {json.dumps(new_item)}")
            print(f"DEBUG: module={module}, type={new_item.get('type')}")
            
            # Wenn es sich um Tools handelt, prüfe auf Duplikate basierend auf dem Pfad
            if module == 'tools' and 'path' in new_item:
                # Prüfe, ob bereits ein Tool mit diesem Pfad existiert
                existing_tool = next((t for t in items if t.get('path') == new_item.get('path')), None)
                if existing_tool:
                    print(f"POST tools: Tool mit Pfad {new_item.get('path')} existiert bereits mit ID {existing_tool.get('id')}")
                    
                    # Aktualisiere das bestehende Tool anstatt ein neues zu erstellen
                    for key, value in new_item.items():
                        if key != 'id':  # ID nicht überschreiben
                            existing_tool[key] = value
                    
                    # Speichere die aktualisierte Liste
                    save_json(module, items)
                    return jsonify(existing_tool), 200
            
            # Generiere eine eindeutige ID für das neue Element
            if module == 'tools':
                # Stelle sicher, dass wir lückenlose IDs haben (1, 2, 3, ...)
                existing_ids = [item.get('id', 0) for item in items if isinstance(item.get('id'), (int, float))]
                next_id = 1
                while next_id in existing_ids:
                    next_id += 1
                new_item['id'] = next_id
            else:
                # Für andere Module verwenden wir die bestehende Methode
                new_item['id'] = max((i.get('id', 0) for i in items), default=0) + 1
            
            # Spezielle Behandlung für Workspaces (nach ID-Generierung)
            if module == 'tools' and new_item.get('type') == 'workspace':
                print(f"DEBUG: Workspace-Logik wird ausgeführt für {new_item.get('name')}")
                # Erstelle automatisch einen Ordner in Documents
                try:
                    import os
                    from pathlib import Path
                    
                    workspace_name = new_item.get('name', 'Unbenannt')

                    safe_name = "".join(c for c in workspace_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                    if not safe_name:
                        safe_name = f"Workspace_{new_item['id']}"

                    workspace_path = os.path.join(WORKSPACES_BASE_DIR, safe_name)
                    
                    # Erstelle den Ordner (rekursiv)
                    os.makedirs(workspace_path, exist_ok=True)
                    
                    # Setze den Pfad im Tool
                    new_item['path'] = workspace_path
                    
                    print(f"Workspace-Ordner erstellt: {workspace_path}")
                    
                except Exception as e:
                    print(f"Fehler beim Erstellen des Workspace-Ordners: {e}")
                    # Fortfahren ohne den Ordner zu erstellen - Tool wird trotzdem gespeichert
            
            # Timestamps hinzufügen
            if 'created_at' not in new_item:
                new_item['created_at'] = get_timestamp_iso()
            
            # Standardwerte für Tools setzen
            if module == 'tools':
                if 'admin' not in new_item:
                    new_item['admin'] = False
                if 'autostart' not in new_item:
                    new_item['autostart'] = False
                if 'tags' not in new_item:
                    new_item['tags'] = []
                if 'favorite' not in new_item:
                    new_item['favorite'] = False
            
            # Standardwerte für FAQ-Elemente
            if module == 'faq':
                if 'tags' not in new_item:
                    new_item['tags'] = []
                if 'favorite' not in new_item:
                    new_item['favorite'] = False
                if 'attachments' not in new_item:
                    new_item['attachments'] = []
            
            # Element zur Liste hinzufügen und speichern
            items.append(new_item)
            save_json(module, items)
            
            print(f"POST {module}: Eintrag erfolgreich erstellt mit ID {new_item['id']}")
            return jsonify(new_item), 201
        except Exception as e:
            error_msg = f"Fehler beim Erstellen eines neuen Eintrags in {module}: {str(e)}"
            print(error_msg)
            error_log = os.path.join(BASE_DIR, 'error.log')
            with open(error_log, 'a', encoding='utf-8') as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
            return jsonify({"error": error_msg}), 500

    @app.route('/api/<module>/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
    def module_item(module, item_id):
        """GET: Einzelnen Eintrag abrufen; PUT: Eintrag aktualisieren; DELETE: Eintrag löschen."""
        items = load_json(module)
        
        # Stelle sicher, dass item_id als Int behandelt wird
        item_id = int(item_id)
        
        # Finde den Index des Elements mit dieser ID
        idx = next((i for i, it in enumerate(items) if it.get('id') == item_id), None)
        if idx is None:
            return jsonify({"error": "Nicht gefunden"}), 404
        
        # GET-Anfrage zum Abrufen eines einzelnen Elements
        if request.method == 'GET':
            return jsonify(items[idx])
        
        # DELETE-Anfrage zum Löschen
        if request.method == 'DELETE':
            # Wenn es ein FAQ-Element ist und Anhänge hat, lösche diese ebenfalls
            if module == 'faq' and 'attachments' in items[idx]:
                for attachment in items[idx].get('attachments', []):
                    if 'path' in attachment:
                        # Extrahiere den Dateinamen aus dem Pfad
                        filename = os.path.basename(attachment['path'])
                        file_path = os.path.join(FAQ_ATTACHMENTS_DIR, filename)
                        try:
                            if os.path.exists(file_path):
                                os.remove(file_path)
                                print(f"Gelöschter Anhang: {file_path}")
                        except Exception as e:
                            print(f"Fehler beim Löschen des Anhangs {file_path}: {str(e)}")
            
            items.pop(idx)
            save_json(module, items)
            return jsonify({"success": True})
        
        # PUT-Anfrage für Aktualisierung
        try:
            # Explizite Fehlerprüfung für JSON-Deserialisierung
            if not request.data:
                return jsonify({"error": "Leerer Request-Body"}), 400
                
            updated_item = request.get_json()
            if updated_item is None:
                return jsonify({"error": "Ungültiges JSON im Request-Body"}), 400
                
            # Debug-Informationen
            print(f"Aktualisiere {module}/{item_id}: {updated_item}")
            
            # ID beibehalten
            updated_item['id'] = item_id
            
            # Update durchführen und bestehende Eigenschaften erhalten
            items[idx] = updated_item
            save_json(module, items)
            return jsonify(updated_item)
        except Exception as e:
            print(f"Fehler bei PUT-Anfrage für {module}/{item_id}: {str(e)}")
            return jsonify({"error": f"Fehler beim Aktualisieren: {str(e)}"}), 500

    @app.route('/api/tools/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
    def tool_item(item_id):
        """GET: Tool abrufen; PUT: Tool aktualisieren; DELETE: Tool löschen."""
        tools = load_json('tools')
        
        # Finde das Tool mit dieser ID
        idx = next((i for i, tool in enumerate(tools) if tool.get('id') == item_id), None)
        if idx is None:
            return jsonify({"error": "Tool nicht gefunden"}), 404
        
        # GET-Anfrage zum Abrufen eines einzelnen Tools
        if request.method == 'GET':
            return jsonify(tools[idx])
        
        # DELETE-Anfrage zum Löschen
        if request.method == 'DELETE':
            tool = tools[idx]
            
            # Lösche die Verknüpfung, wenn vorhanden
            if tool.get('shortcut_path') and os.path.exists(tool.get('shortcut_path')):
                try:
                    os.remove(tool.get('shortcut_path'))
                    print(f"Verknüpfung gelöscht: {tool.get('shortcut_path')}")
                except Exception as e:
                    print(f"Fehler beim Löschen der Verknüpfung: {e}")
            
            # Tool aus der Liste entfernen
            tools.pop(idx)
            save_json('tools', tools)
            
            return jsonify({"success": True, "message": f"Tool '{tool.get('name')}' wurde gelöscht"})
        
        # PUT-Anfrage für Aktualisierung
        try:
            updated_tool = request.get_json()
            if not updated_tool:
                return jsonify({"error": "Ungültige Daten"}), 400
            
            # Original-Tool für Vergleiche speichern
            original_tool = tools[idx]
            
            # ID beibehalten
            updated_tool['id'] = item_id
            
            # Prüfen, ob sich Name oder Pfad geändert haben - dann Verknüpfung aktualisieren
            name_changed = original_tool.get('name') != updated_tool.get('name')
            path_changed = original_tool.get('path') != updated_tool.get('path')
            
            if (name_changed or path_changed) and updated_tool.get('path'):
                # Alte Verknüpfung löschen, wenn vorhanden
                if original_tool.get('shortcut_path') and os.path.exists(original_tool.get('shortcut_path')):
                    try:
                        os.remove(original_tool.get('shortcut_path'))
                        print(f"Alte Verknüpfung gelöscht: {original_tool.get('shortcut_path')}")
                    except Exception as e:
                        print(f"Fehler beim Löschen der alten Verknüpfung: {e}")
                
                # Neue Verknüpfung erstellen
                shortcut_name = updated_tool.get('name', f"Tool_{item_id}")
                shortcut_path = create_shortcut(updated_tool.get('path'), shortcut_name)
                
                if shortcut_path:
                    updated_tool['shortcut_path'] = shortcut_path
                    print(f"Neue Verknüpfung erstellt: {shortcut_path}")
            
            # Tool in der Liste aktualisieren
            tools[idx] = updated_tool
            save_json('tools', tools)
            
            return jsonify(updated_tool)
        except Exception as e:
            error_msg = f"Fehler beim Aktualisieren des Tools: {str(e)}"
            print(error_msg)
            return jsonify({"error": error_msg}), 500

    @app.route('/api/start-tool', methods=['POST'])
    def start_tool():
        """Startet ein Tool auf dem Server."""
        try:
            # Validiere, dass gültige JSON-Daten gesendet wurden
            if not request.data:
                return jsonify({"error": "Leerer Request-Body"}), 400

            data = request.get_json()
            if data is None:
                return jsonify({"error": "Ungültiges JSON im Request-Body"}), 400

            tool_id = data.get('id')
            if not tool_id:
                return jsonify({"error": "Keine Tool-ID angegeben"}), 400

            use_shortcut = data.get('use_shortcut', False)
            is_workspace_tool = data.get('is_workspace_tool', False)
            direct_path = data.get('path')

            # Spezielle Behandlung für Workspace-Tools
            if is_workspace_tool and direct_path:
                try:
                    import subprocess
                    if os.name == 'nt':
                        # Verwende os.startfile für .lnk Dateien
                        os.startfile(direct_path)
                    else:
                        subprocess.Popen([direct_path])
                    
                    return jsonify({
                        "success": True,
                        "name": f"Workspace-Tool {tool_id}",
                        "message": f"Workspace-Tool gestartet: {direct_path}"
                    })
                except Exception as e:
                    return jsonify({
                        "success": False,
                        "error": f"Workspace-Tool konnte nicht gestartet werden: {str(e)}"
                    }), 500

            tools = load_json('tools')
            tool = next((t for t in tools if t.get('id') == tool_id), None)
            if not tool:
                return jsonify({"error": f"Tool mit ID {tool_id} nicht gefunden"}), 404

            tool_path = tool.get('path', '')
            is_admin = tool.get('admin', False)
            tool_type = tool.get('type', 'executable')
            browser_choice = tool.get('browser', 'default')

            if not tool_path:
                return jsonify({"error": "Tool hat keinen gültigen Pfad"}), 400

            launch_successful = False
            actual_start_mode = ""
            actual_admin = False
            error_details = ""

            # Versuche zuerst, den Host-Launcher zu verwenden (wenn vorhanden). Falls dieser nicht erreichbar ist,
            # falle auf lokalen Start zurück.
            tried_host_launcher = False
            host_launcher_unavailable = False
            host_launcher_short_msg = None
            try:
                import requests
                host_launcher_url = "http://host.docker.internal:5412/api/host-launch"
                payload = {"path": tool_path, "admin": is_admin, "type": tool_type}
                tried_host_launcher = True
                try:
                    resp = requests.post(host_launcher_url, json=payload, timeout=5)
                    if resp.ok:
                        result = resp.json()
                        if result.get('success', False):
                            log_tool_usage(tool)
                            return jsonify({
                                "success": True,
                                "name": tool.get('name', 'Unbekanntes Tool'),
                                "admin": is_admin,
                                "used_shortcut": use_shortcut,
                                "requested_admin": is_admin,
                                "actual_start_mode": "host-launch",
                                "message": result.get('message', f"Tool \"{tool.get('name', 'Unbekanntes Tool')}\" gestartet (host-launch)")
                            })
                        else:
                            # Host launcher returned an application-level error; log details but continue to local fallback
                            host_launcher_short_msg = "Host-Launcher meldete einen Fehler"
                            print(f"Host-Launcher returned error response: {resp.status_code} {resp.text}")
                    else:
                        host_launcher_short_msg = "Host-Launcher meldete einen HTTP-Fehler"
                        print(f"Host-Launcher returned HTTP {resp.status_code}: {resp.text}")
                except Exception as e:
                    # Network-level error or timeout
                    host_launcher_unavailable = True
                    host_launcher_short_msg = "Host-Launcher nicht erreichbar"
                    print(f"Host-launcher not reachable: {e}")
            except Exception as e:
                # requests not available or other import error -> skip host launcher
                host_launcher_unavailable = True
                host_launcher_short_msg = "Host-Launcher nicht verfügbar (requests fehlt)"
                print(f"Skipping host-launcher call: {e}")

            # Wenn Host-Launcher nicht verfügbar oder Fehler zurückliefert: starte lokal
            try:
                if os.name == 'nt':
                    os.startfile(tool_path)
                    launch_successful = True
                    actual_start_mode = "os.startfile"
                else:
                    subprocess.Popen([tool_path])
                    launch_successful = True
                    actual_start_mode = "subprocess"
            except Exception as e:
                error_details = f'Direkter Start fehlgeschlagen: {e}'
                launch_successful = False

            if launch_successful:
                log_tool_usage(tool)
                # If host-launcher was tried but failed, return a friendly hint instead of raw exception text
                message = f"Tool \"{tool.get('name', 'Unbekanntes Tool')}\" gestartet ({actual_start_mode})"
                if tried_host_launcher and host_launcher_short_msg:
                    message += f"; Hinweis: {host_launcher_short_msg}. Lokaler Start verwendet."

                return jsonify({
                    "success": True,
                    "name": tool.get('name', 'Unbekanntes Tool'),
                    "admin": actual_admin,
                    "used_shortcut": use_shortcut,
                    "requested_admin": is_admin,
                    "actual_start_mode": actual_start_mode,
                    "message": message
                })
            else:
                # Beide Versuche schlugen fehl
                # Prepare a short, user-friendly error message. Detailed errors are logged on the server.
                user_msg_parts = []
                if tried_host_launcher:
                    if host_launcher_unavailable:
                        user_msg_parts.append('Host-Launcher nicht erreichbar')
                    else:
                        user_msg_parts.append('Host-Launcher meldete einen Fehler')
                user_msg_parts.append('Lokaler Start fehlgeschlagen')
                user_friendly = '; '.join(user_msg_parts)
                # Log the detailed error server-side for debugging
                print(f"Start-Fehler (detailliert): host_launcher_unavailable={host_launcher_unavailable}, host_msg={host_launcher_short_msg}, local_error={error_details}")
                return jsonify({
                    "success": False,
                    "name": tool.get('name', 'Unbekanntes Tool'),
                    "error": f"Tool konnte nicht gestartet werden: {user_friendly}",
                    "requested_admin": is_admin,
                }), 500

        except Exception as e:
            error_msg = f"Fehler bei der Verarbeitung der Anfrage: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return jsonify({"error": error_msg}), 500

    @app.route('/api/file-browser', methods=['GET'])
    def file_browser():
        """Kompatibilitätsroute für alte Anfragen."""
        return file_browser_simple()

    @app.route('/api/file-browser-simple', methods=['GET'])
    def file_browser_simple():
        """Öffnet einen Datei-Dialog über host_launcher."""
        try:
            # Versuche zunächst, den host_launcher zu erreichen. Falls dieser nicht erreichbar ist,
            # verwende einen lokalen PowerShell-Dateidialog als Fallback.
            try:
                import requests
                host_launcher_url = "http://host.docker.internal:5412/api/file-browser"
                try:
                    response = requests.get(host_launcher_url, timeout=60)  # Longer timeout for dialog
                    if response.ok:
                        return jsonify(response.json())
                    else:
                        print(f"Host-Launcher returned HTTP {response.status_code}: {response.text}")
                        # fallthrough to local picker
                except Exception as e:
                    print(f"Host-Launcher not reachable: {e}")
                    # fallthrough to local picker
            except Exception:
                # requests not available in this environment - fall back to local picker
                pass

            # Fallback: lokal PowerShell-Dateidialog (kopiert aus offline server logic)
            try:
                script_path = os.path.join(BASE_DIR, f'file_picker_{time.time()}.ps1')
                ps_code = r"""
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type @"
                using System;
                using System.Runtime.InteropServices;
                public class WindowHelper {
                    [DllImport("user32.dll")]
                    [return: MarshalAs(UnmanagedType.Bool)]
                    public static extern bool SetForegroundWindow(IntPtr hWnd);
                    [DllImport("user32.dll")]
                    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetActiveWindow();
                }
"@
                [System.Windows.Forms.Application]::EnableVisualStyles()
                [System.Windows.Forms.Application]::DoEvents()
                $form = New-Object System.Windows.Forms.Form
                $form.TopMost = $true
                $form.Opacity = 0
                $form.ShowInTaskbar = $false
                $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
                $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
                $form.Show()
                $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
                $currentWindowHandle = [WindowHelper]::GetActiveWindow()
                [WindowHelper]::SetForegroundWindow($currentWindowHandle)
                [WindowHelper]::ShowWindow($currentWindowHandle, 5)
                $dialog = New-Object System.Windows.Forms.OpenFileDialog
                $dialog.Filter = "Programme (*.exe)|*.exe|Verknüpfungen (*.lnk)|*.lnk|Alle Dateien (*.*)|*.*"
                $dialog.Title = "Programm auswählen (HelpTool)"
                $dialog.CheckFileExists = $true
                Start-Sleep -Milliseconds 500
                [System.Windows.Forms.Application]::DoEvents()
                $result = $dialog.ShowDialog($form)
                $form.Close()
                if ($result -eq 'OK') {
                    $path = $dialog.FileName
                    $name = [System.IO.Path]::GetFileNameWithoutExtension($path)
                    $extension = [System.IO.Path]::GetExtension($path)
                    $isShortcut = $extension -eq ".lnk"
                    $target = $null
                    if ($isShortcut) {
                        try {
                            $shell = New-Object -ComObject WScript.Shell
                            $shortcut = $shell.CreateShortcut($path)
                            $target = $shortcut.TargetPath
                        } catch {}
                    }
                    $result = @{
                        status = "completed"
                        data = @{
                            path = $path
                            name = $name
                            extension = $extension
                            is_shortcut = $isShortcut
                            target = $target
                        }
                    }
                    $result | ConvertTo-Json -Depth 3
                } else {
                    @{ status = "cancelled" } | ConvertTo-Json
                }
                """
                with open(script_path, 'w', encoding='utf-8') as f:
                    f.write(ps_code)
                result = subprocess.run(
                    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Normal", "-File", script_path],
                    capture_output=True,
                    text=True
                )
                try:
                    os.remove(script_path)
                except Exception:
                    pass
                if result.returncode == 0:
                    stdout = result.stdout.strip()
                    if stdout:
                        return jsonify(json.loads(stdout))
                    else:
                        return jsonify({"status": "cancelled"})
                else:
                    stderr = result.stderr.strip() or "Unbekannter Fehler"
                    print(f"PowerShell Fehler: {stderr}")
                    return jsonify({"status": "error", "error": stderr}), 500
            except Exception as e:
                print(f"Fehler im lokalen Dateibrowser-Fallback: {e}")
                return jsonify({"status": "error", "error": str(e)}), 500
        except Exception as e:
            print(f"Allgemeiner Fehler im Dateibrowser: {str(e)}")
            return jsonify({"status": "error", "error": str(e)}), 500

    @app.route('/api/file-icon', methods=['GET'])
    def get_file_icon():
        """Extrahiert das Icon einer Datei und gibt es zurück."""
        try:
            file_path = request.args.get('path')
            if not file_path:
                return jsonify({"error": "Kein Dateipfad angegeben"}), 400
                
            # Überprüfen, ob die Datei existiert
            if not os.path.exists(file_path):
                print(f"Datei nicht gefunden: {file_path}")
                return send_file(os.path.join(app.static_folder, 'static/img/default-tool-icon.png'), mimetype='image/png')
            
            # Windows-spezifische Icon-Extraktion über PowerShell
            try:
                # Temporäre Datei für das Icon erstellen
                icon_dir = os.path.join(app.static_folder, 'static/img/icons')
                os.makedirs(icon_dir, exist_ok=True)
                
                # Erstelle einen eindeutigen Dateinamen basierend auf dem Dateipfad
                hashed_path = str(hash(file_path))
                icon_file = os.path.join(icon_dir, f"icon_{hashed_path}.png")
                
                # Wenn das Icon bereits existiert, sende es direkt
                if os.path.exists(icon_file):
                    return send_file(icon_file, mimetype='image/png')
                
                # PowerShell-Skript zum Extrahieren des Icons
                ps_script = f"""
                Add-Type -AssemblyName System.Drawing
                
                function Get-Icon {{
                    param([string]$FilePath)
                    
                    try {{
                        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($FilePath)
                        if ($icon) {{
                            $bitmap = New-Object System.Drawing.Bitmap($icon.Width, $icon.Height)
                            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                            $graphics.DrawIcon($icon, 0, 0)
                            $bitmap.Save("{icon_file}")
                            $graphics.Dispose()
                            $bitmap.Dispose()
                            $icon.Dispose()
                            return $true
                        }}
                    }} catch {{
                        return $false
                    }}
                    return $false
                }}
                
                Get-Icon -FilePath "{file_path}"
                """
                
                # Erstelle eine temporäre PS1-Datei und führe sie aus
                ps_file = os.path.join(BASE_DIR, f"extract_icon_{int(time.time())}.ps1")
                with open(ps_file, 'w', encoding='utf-8') as f:
                    f.write(ps_script)
                
                # PowerShell-Skript ausführen
                subprocess.run(
                    ["powershell", "-ExecutionPolicy", "Bypass", "-File", ps_file],
                    capture_output=True, text=True
                )
                
                # Temporäre Datei löschen
                if os.path.exists(ps_file):
                    os.remove(ps_file)
                
                # Überprüfen, ob das Icon erstellt wurde
                if os.path.exists(icon_file):
                    return send_file(icon_file, mimetype='image/png')
                
                # Fallback: Generiere ein einfaches Platzhalterbild mit dem Dateityp
                file_extension = os.path.splitext(file_path)[1].lower()[1:]  # Entferne den Punkt
                
                # Erstelle ein einfaches Icon mit dem Dateityp
                img = Image.new('RGB', (48, 48), color=(100, 149, 237))  # Kornblumenblau
                d = ImageDraw.Draw(img)
                d.rectangle([0, 0, 47, 47], outline=(255, 255, 255))
                
                # Zeichne die Dateierweiterung auf das Bild
                if file_extension:
                    # Zentriere den Text
                    font_size = 16
                    text_width = len(file_extension) * (font_size // 2)
                    text_x = max(24 - text_width // 2, 5)
                    text_y = 16
                    
                    # Zeichne den Text weiß
                    d.text((text_x, text_y), file_extension.upper(), fill=(255, 255, 255))
                else:
                    # Wenn keine Erweiterung, zeichne ein generisches Symbol
                    d.rectangle([10, 10, 38, 38], outline=(255, 255, 255))
                
                # Speichere das generierte Bild
                img.save(icon_file)
                
                return send_file(icon_file, mimetype='image/png')
                
            except Exception as e:
                print(f"Fehler bei der Icon-Extraktion: {e}")
                # Fallback auf Standard-Icon
                return send_file(os.path.join(app.static_folder, 'static/img/default-tool-icon.png'), mimetype='image/png')
                
        except Exception as e:
            print(f"Allgemeiner Fehler in get_file_icon: {e}")
            # Fallback auf Standard-Icon
            return send_file(os.path.join(app.static_folder, 'static/img/default-tool-icon.png'), mimetype='image/png')

    # Network module API endpoints
    @app.route('/api/network/ping', methods=['POST'])
    def ping_device():
        """Ping a network device and return status information."""
        try:
            data = request.get_json()
            if not data or 'deviceId' not in data:
                return jsonify({"error": "Keine Geräte-ID angegeben"}), 400
                
            device_id = data['deviceId'].strip()
            
            # Validate input - check if it's at least a reasonable hostname or IP
            if not device_id or len(device_id) < 1:
                return jsonify({"error": "Ungültige Eingabe"}), 400
                
            # Basic validation for hostname/IP format
            import re
            ip_pattern = re.compile(r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$')
            hostname_pattern = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$')
            
            if not (ip_pattern.match(device_id) or hostname_pattern.match(device_id)):
                return jsonify({
                    "device_id": device_id,
                    "is_online": False,
                    "hostname": None,
                    "ip_address": None,
                    "network_path": None,
                    "in_database": False,
                    "error": "Ungültiges Format für Hostname oder IP-Adresse"
                }), 200
            
            # Use actual ping command for Windows
            try:
                # Ping with 4 packets and timeout of 3 seconds per packet
                # Use encoding='cp850' for German Windows command prompt
                result = subprocess.run(['ping', '-n', '4', '-w', '3000', device_id], 
                                        capture_output=True, text=True, encoding='cp850', errors='ignore', timeout=15)
                
                # Debug output
                print(f"Ping result for {device_id}:")
                print(f"Return code: {result.returncode}")
                print(f"Stdout: {result.stdout}")
                print(f"Stderr: {result.stderr}")
                
                # First check: return code must be 0 for success
                is_online = result.returncode == 0
                
                # Additional validation - check ping output content
                if result.stdout:
                    # Check for failure indicators first (these override return code)
                    failure_indicators = [
                        'konnte nicht gefunden werden', 'could not find host',
                        'Ping-Anforderung konnte Host', 'Ping request could not find host',
                        'Zielhost nicht erreichbar', 'Destination host unreachable', 
                        'Zeitüberschreitung', 'Request timeout', 'timed out',
                        'Allgemeiner Fehler', 'General failure',
                        'Überprüfen Sie den Namen', 'Check the name'
                    ]
                    has_failure = any(indicator in result.stdout for indicator in failure_indicators)
                    
                    if has_failure:
                        is_online = False
                        print(f"Ping failed due to error message in output")
                    elif is_online:
                        # Only if return code was 0, check for success indicators
                        success_indicators = [
                            'TTL=', 'Zeit=', 'time=', 'TTL ='
                        ]
                        has_valid_response = any(indicator in result.stdout for indicator in success_indicators)
                        
                        # Must have valid response to be considered online
                        is_online = has_valid_response
                        print(f"Valid response found: {has_valid_response}")
                else:
                    is_online = False
                    print("No stdout output from ping command")
                
                # Try to extract IP address from ping result if device is online
                ip_address = None
                if is_online:
                    # Look for IP address pattern in ping output (German and English)
                    ip_match = re.search(r'Ping wird ausgeführt für .+ \[(\d+\.\d+\.\d+\.\d+)\]', result.stdout) or \
                               re.search(r'Pinging .+ \[(\d+\.\d+\.\d+\.\d+)\]', result.stdout) or \
                               re.search(r'Antwort von (\d+\.\d+\.\d+\.\d+)', result.stdout) or \
                               re.search(r'Reply from (\d+\.\d+\.\d+\.\d+)', result.stdout)
                    if ip_match:
                        ip_address = ip_match.group(1)
                
                # Try to get hostname
                hostname = None
                if is_online:
                    try:
                        hostname = socket.gethostbyaddr(ip_address if ip_address else device_id)[0]
                    except:
                        # If hostname lookup fails, use device_id
                        hostname = device_id.upper()
                        
            except subprocess.TimeoutExpired:
                print(f"Ping timeout for {device_id}")
                is_online = False
                hostname = None
                ip_address = None
            except Exception as ping_error:
                print(f"Ping error for {device_id}: {ping_error}")
                is_online = False
                hostname = None
                ip_address = None
            
            # Build a response with device details
            response = {
                "device_id": device_id,
                "is_online": is_online,
                "hostname": hostname,
                "ip_address": ip_address,
                "network_path": f"\\\\{device_id.lower()}\\c$",
                "in_database": True
            }
            
            # Try to save device to database if not exists
            devices = load_json('network_devices')
            existing_device = next((d for d in devices if d.get('id') == device_id), None)
            
            if not existing_device:
                # Add new device
                new_device = {
                    "id": device_id,
                    "name": f"Device {device_id}",
                    "ip": response["ip_address"],
                    "is_online": is_online,
                    "last_seen": get_timestamp_iso() if is_online else None,
                    "network_path": response["network_path"]
                }
                devices.append(new_device)
                save_json('network_devices', devices)
            else:
                # Update existing device
                existing_device["ip"] = response["ip_address"]
                existing_device["is_online"] = is_online
                if is_online:
                    existing_device["last_seen"] = get_timestamp_iso()
                save_json('network_devices', devices)
            
            return jsonify(response)
            
        except Exception as e:
            print(f"Error in ping_device: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/network/devices', methods=['GET'])
    def get_network_devices():
        """Get list of network devices from database."""
        try:
            devices = load_json('network_devices')
            return jsonify(devices)
        except Exception as e:
            print(f"Error in get_network_devices: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/network/settings', methods=['GET', 'PUT'])
    def network_settings():
        """Get or update network settings."""
        try:
            settings_path = os.path.join(DATA_DIR, 'network_settings.json')
            
            # Default settings if file doesn't exist
            default_settings = {
                "network_path_template": "\\\\{device_id}\\c$",
                "install_folder_path": "\\\\server\\installs",
                "ping_timeout": 5,
                "scan_subnet": "192.168.1.0/24"
            }
            
            # GET: Return current settings
            if request.method == 'GET':
                if os.path.exists(settings_path):
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        settings = json.load(f)
                else:
                    # Create default settings file if it doesn't exist
                    settings = default_settings
                    with open(settings_path, 'w', encoding='utf-8') as f:
                        json.dump(settings, f, indent=2)
                
                return jsonify(settings)
            
            # PUT: Update settings
            elif request.method == 'PUT':
                data = request.get_json()
                if not data:
                    return jsonify({"error": "Keine Daten erhalten"}), 400
                
                # Load current settings if exists or use defaults
                if os.path.exists(settings_path):
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        settings = json.load(f)
                else:
                    settings = default_settings
                
                # Update settings
                for key, value in data.items():
                    settings[key] = value
                
                # Save updated settings
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(settings, f, indent=2)
                
                return jsonify(settings)
                
        except Exception as e:
            print(f"Error in network_settings: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/network/shortcuts', methods=['GET', 'POST'])
    def network_shortcuts():
        """Get or add network shortcuts."""
        try:
            shortcuts_path = os.path.join(DATA_DIR, 'network_shortcuts.json')
            
            # GET: Return current shortcuts
            if request.method == 'GET':
                if os.path.exists(shortcuts_path):
                    with open(shortcuts_path, 'r', encoding='utf-8') as f:
                        shortcuts = json.load(f)
                else:
                    # Create default shortcuts file if it doesn't exist
                    shortcuts = []
                    with open(shortcuts_path, 'w', encoding='utf-8') as f:
                        json.dump(shortcuts, f, indent=2)

                return jsonify(shortcuts)
            
            # POST: Add new shortcut
            elif request.method == 'POST':
                data = request.get_json()
                if not data or 'path' not in data:
                    return jsonify({"error": "Kein Pfad angegeben"}), 400
                
                # Load current shortcuts if exists
                if os.path.exists(shortcuts_path):
                    with open(shortcuts_path, 'r', encoding='utf-8') as f:
                        shortcuts = json.load(f)
                else:
                    shortcuts = []
                
                # Add new shortcut
                new_shortcut = {
                    "path": data['path'],
                    "created_at": get_timestamp_iso()
                }
                shortcuts.append(new_shortcut)
                
                # Save updated shortcuts
                with open(shortcuts_path, 'w', encoding='utf-8') as f:
                    json.dump(shortcuts, f, indent=2)
                
                return jsonify(new_shortcut), 201
                
        except Exception as e:
            print(f"Error in network_shortcuts: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/network/shortcuts/<int:index>', methods=['PUT', 'DELETE'])
    def network_shortcut_item(index):
        """Update or delete a specific network shortcut."""
        try:
            shortcuts_path = os.path.join(DATA_DIR, 'network_shortcuts.json')
            
            # Check if shortcuts file exists
            if not os.path.exists(shortcuts_path):
                return jsonify({"error": "Keine Shortcuts gefunden"}), 404
                
            # Load shortcuts
            with open(shortcuts_path, 'r', encoding='utf-8') as f:
                shortcuts = json.load(f)
            
            # Check if index is valid
            if index < 0 or index >= len(shortcuts):
                return jsonify({"error": "Ungültiger Index"}), 404
            
            # PUT: Update shortcut
            if request.method == 'PUT':
                data = request.get_json()
                if not data or 'path' not in data:
                    return jsonify({"error": "Kein Pfad angegeben"}), 400
                
                shortcuts[index]['path'] = data['path']
                shortcuts[index]['updated_at'] = get_timestamp_iso()
                
                # Save updated shortcuts
                with open(shortcuts_path, 'w', encoding='utf-8') as f:
                    json.dump(shortcuts, f, indent=2)
                
                return jsonify(shortcuts[index])
            
            # DELETE: Remove shortcut
            elif request.method == 'DELETE':
                removed = shortcuts.pop(index)
                
                # Save updated shortcuts
                with open(shortcuts_path, 'w', encoding='utf-8') as f:
                    json.dump(shortcuts, f, indent=2)
                
                return jsonify({"success": True, "removed": removed})
                
        except Exception as e:
            print(f"Error in network_shortcut_item: {str(e)}")
            return jsonify({"error": str(e)}), 500
            
    # --- Kalender/Termine API ---

    @app.route('/api/termine', methods=['GET'])
    def get_termine():
        termine = load_json('termine')
        return jsonify(termine)

    # Alias-Endpunkt für Kalender im Telefonbuch
    @app.route('/api/telefonbuch/termine', methods=['GET'])
    def get_telefonbuch_termine():
        termine = load_json('termine')
        return jsonify(termine)

    @app.route('/api/termine', methods=['POST'])
    def add_termin():
        data = request.get_json(force=True)
        termine = load_json('termine')
        new_id = max([t.get('id', 0) for t in termine], default=0) + 1
        data['id'] = new_id
        data['created_at'] = get_timestamp_iso()
        termine.append(data)
        save_json('termine', termine)
        return jsonify(data), 201

    # FAQ-Anhang-Endpunkte
    @app.route('/api/faq-attachments', methods=['POST'])
    def upload_faq_attachment():
        """Lädt einen Anhang für ein FAQ-Element hoch."""
        try:
            if 'file' not in request.files:
                return jsonify({"error": "Keine Datei im Request"}), 400
                
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "Kein Dateiname angegeben"}), 400
                
            if file and allowed_file(file.filename):
                # Generiere einen sicheren Dateinamen
                filename = secure_filename(file.filename)
                # Füge Timestamp hinzu, um Eindeutigkeit zu gewährleisten
                timestamp = int(time.time())
                name, ext = os.path.splitext(filename)
                unique_filename = f"{name}_{timestamp}{ext}"
                
                # Speichere die Datei
                file_path = os.path.join(FAQ_ATTACHMENTS_DIR, unique_filename)
                file.save(file_path)
                
                # Bestimme den relativen Pfad für den Frontend-Zugriff
                relative_path = f"api/faq-attachments/{unique_filename}"
                
                # Gib den relativen Pfad zurück, über den der Anhang abgerufen werden kann
                return jsonify({
                    "filename": filename,
                    "path": relative_path,
                    "type": ext.lower()[1:] if ext else ""
                }), 201
            else:
                return jsonify({"error": f"Dateityp nicht erlaubt. Erlaubte Typen: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
                
        except Exception as e:
            error_msg = f"Fehler beim Hochladen des FAQ-Anhangs: {str(e)}"
            print(error_msg)
            error_log = os.path.join(BASE_DIR, 'error.log')
            with open(error_log, 'a', encoding='utf-8') as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
            return jsonify({"error": error_msg}), 500
            
    @app.route('/api/faq-attachments/<filename>', methods=['GET'])
    def get_faq_attachment(filename):
        """Ruft einen FAQ-Anhang ab."""
        try:
            return send_from_directory(FAQ_ATTACHMENTS_DIR, filename)
        except Exception as e:
            print(f"Fehler beim Abrufen des FAQ-Anhangs: {str(e)}")
            return jsonify({"error": f"Anhang nicht gefunden: {str(e)}"}), 404
            
    @app.route('/api/faq-attachments/<filename>', methods=['DELETE'])
    def delete_faq_attachment(filename):
        """Löscht einen FAQ-Anhang."""
        try:
            file_path = os.path.join(FAQ_ATTACHMENTS_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                return jsonify({"success": True, "message": f"Anhang {filename} erfolgreich gelöscht"}), 200
            else:
                return jsonify({"error": f"Anhang {filename} nicht gefunden"}), 404
        except Exception as e:
            error_msg = f"Fehler beim Löschen des FAQ-Anhangs: {str(e)}"
            print(error_msg)
            error_log = os.path.join(BASE_DIR, 'error.log')
            with open(error_log, 'a', encoding='utf-8') as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
            return jsonify({"error": error_msg}), 500

@app.route('/api/create-shortcut', methods=['POST'])
def api_create_shortcut():
    """Erstellt eine Verknüpfung für ein Tool."""
    try:
        data = request.get_json()
        if not data or 'tool_id' not in data:
            return jsonify({"error": "tool_id erforderlich"}), 400
            
        tool_id = data['tool_id']
        tools = load_json('tools')
        tool = next((t for t in tools if t['id'] == tool_id), None)
        
        if not tool:
            return jsonify({"error": "Tool nicht gefunden"}), 404
            
        shortcut_path = create_shortcut(tool['path'], tool['name'])
        if shortcut_path:
            return jsonify({"success": True, "shortcut_path": shortcut_path})
        else:
            return jsonify({"error": "Verknüpfung konnte nicht erstellt werden"}), 500
            
    except Exception as e:
        print(f"Fehler in api_create_shortcut: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/workspace-tools', methods=['GET'])
def api_get_workspace_tools():
    """Scannt alle Workspace-Ordner nach .lnk Dateien und gibt sie als Tools zurück."""
    try:
        import os
        from pathlib import Path
        
        workspace_tools = []
        tools = load_json('tools')
        
        # Finde alle Workspace-Tools
        workspaces = [t for t in tools if t.get('type') == 'workspace' and t.get('path')]
        
        for workspace in workspaces:
            workspace_path = workspace['path']
            
            if not os.path.exists(workspace_path):
                continue
                
            # Scanne nach .lnk Dateien
            try:
                for file_path in Path(workspace_path).rglob('*.lnk'):
                    try:
                        # Erstelle ein Tool-Objekt für jede .lnk Datei
                        tool_name = file_path.stem  # Name ohne .lnk Erweiterung
                        tool_path = str(file_path)
                        
                        # Erstelle eine eindeutige ID basierend auf dem Pfad
                        tool_id = hash(tool_path) % 1000000  # Begrenze auf 6 Stellen
                        
                        workspace_tool = {
                            'id': tool_id,
                            'name': tool_name,
                            'path': tool_path,
                            'type': 'workspace-tool',
                            'workspace_id': workspace['id'],
                            'workspace_name': workspace['name'],
                            'admin': False,
                            'autostart': False,
                            'favorite': False,
                            'tags': ['workspace', f"workspace-{workspace['id']}"],
                            'created_at': workspace.get('created_at', get_timestamp_iso())
                        }
                        
                        workspace_tools.append(workspace_tool)
                        
                    except Exception as e:
                        print(f"Fehler beim Verarbeiten der .lnk Datei {file_path}: {e}")
                        continue
                        
            except Exception as e:
                print(f"Fehler beim Scannen des Workspace-Ordners {workspace_path}: {e}")
                continue
        
        return jsonify(workspace_tools)
        
    except Exception as e:
        print(f"Fehler in api_get_workspace_tools: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/workspace/<int:workspace_id>/remove-tool', methods=['POST'])
def api_workspace_remove_tool(workspace_id):
    """Entfernt ein Tool aus einem Workspace, indem die entsprechende .lnk Datei gelöscht wird."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Kein JSON im Request"}), 400

        tool_id = data.get('tool_id')
        if not tool_id:
            return jsonify({"error": "tool_id erforderlich"}), 400

        tools = load_json('tools')
        workspace = next((t for t in tools if t.get('id') == workspace_id and t.get('type') == 'workspace'), None)
        if not workspace:
            return jsonify({"error": "Workspace nicht gefunden"}), 404

        workspace_path = workspace.get('path')
        if not workspace_path or not os.path.exists(workspace_path):
            return jsonify({"error": "Workspace-Ordner nicht gefunden"}), 404

        # Versuche zuerst, das Tool anhand der ID in der Datenbank zu finden
        tool = next((t for t in tools if t.get('id') == int(tool_id)), None)
        tool_name = None

        if tool:
            # Tool gefunden - verwende den echten Namen
            tool_name = tool.get('name', f"Tool_{tool_id}")
        else:
            # Tool nicht in Datenbank gefunden - suche nach .lnk Dateien im Workspace
            # und finde die mit der entsprechenden generierten ID
            print(f"DEBUG api_workspace_remove_tool: Tool {tool_id} nicht in Datenbank gefunden, suche nach .lnk Dateien")

            for filename in os.listdir(workspace_path):
                if filename.endswith('.lnk'):
                    lnk_path = os.path.join(workspace_path, filename)
                    # Generiere die gleiche ID wie in api_get_workspace_tools_by_id
                    generated_id = hash(lnk_path) % 1000000
                    if generated_id == int(tool_id):
                        tool_name = filename.replace('.lnk', '')
                        print(f"DEBUG api_workspace_remove_tool: Gefunden: {filename} mit generierter ID {generated_id}")
                        break

        if not tool_name:
            return jsonify({"error": "Tool nicht gefunden"}), 404

        # Finde und lösche die entsprechende .lnk Datei
        lnk_filename = f"{tool_name}.lnk"
        lnk_path = os.path.join(workspace_path, lnk_filename)

        if os.path.exists(lnk_path):
            os.remove(lnk_path)
            print(f"DEBUG api_workspace_remove_tool: {lnk_path} erfolgreich entfernt")
            return jsonify({"success": True, "message": "Tool aus Workspace entfernt"})
        else:
            return jsonify({"error": "Verknüpfung nicht gefunden"}), 404

    except Exception as e:
        print(f"Fehler in api_workspace_remove_tool: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/workspace/<int:workspace_id>/tools', methods=['GET'])
def api_get_workspace_tools_by_id(workspace_id):
    """Gibt alle Tools zurück, die in einem spezifischen Workspace enthalten sind."""
    try:
        tools = load_json('tools')
        workspace = next((t for t in tools if t.get('id') == workspace_id and t.get('type') == 'workspace'), None)
        if not workspace:
            print(f"DEBUG api_get_workspace_tools_by_id: Workspace mit ID {workspace_id} nicht gefunden")
            return jsonify({"error": "Workspace nicht gefunden"}), 404

        workspace_path = workspace.get('path')
        print(f"DEBUG api_get_workspace_tools_by_id: Workspace {workspace_id} ({workspace.get('name')}): Pfad = {workspace_path}")
        
        # Erstelle Workspace-Pfad, wenn er fehlt (ähnlich wie in api_workspace_import)
        documents_workspace_prefix = os.path.join(os.path.expanduser('~'), 'Documents', 'HelpTool_Workspaces')
        needs_migration = (
            not workspace_path or
            os.path.normcase(workspace_path).startswith(os.path.normcase(documents_workspace_prefix))
        )

        if needs_migration:
            try:
                workspace_name = workspace.get('name', f"Workspace_{workspace_id}")
                safe_name = "".join(c for c in workspace_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                if not safe_name:
                    safe_name = f"Workspace_{workspace_id}"

                workspace_path = os.path.join(WORKSPACES_BASE_DIR, safe_name)
                os.makedirs(workspace_path, exist_ok=True)

                workspace['path'] = workspace_path
                for idx, existing_tool in enumerate(tools):
                    if existing_tool.get('id') == workspace['id']:
                        tools[idx]['path'] = workspace_path
                        break
                save_json('tools', tools)
                print(f"DEBUG api_get_workspace_tools_by_id: Workspace-Pfad nachträglich gesetzt: {workspace_path}")
            except Exception as path_error:
                print(f"DEBUG api_get_workspace_tools_by_id: Fehler beim Erstellen des Workspace-Pfads: {path_error}")
                return jsonify([])  # Leere Liste zurückgeben statt Fehler
        
        if not workspace_path or not os.path.exists(workspace_path):
            print(f"DEBUG api_get_workspace_tools_by_id: Workspace-Ordner existiert nicht: {workspace_path}")
            return jsonify([])  # Leere Liste, wenn Workspace-Ordner nicht existiert

        workspace_tools = []
        
        # Scanne den Workspace-Ordner nach .lnk Dateien
        print(f"DEBUG api_get_workspace_tools_by_id: Scanne Ordner: {workspace_path}")
        for filename in os.listdir(workspace_path):
            print(f"DEBUG api_get_workspace_tools_by_id: Gefunden: {filename}")
            if filename.endswith('.lnk'):
                lnk_path = os.path.join(workspace_path, filename)
                
                # Lese Tool-Informationen aus der .lnk-Datei
                tool_name = filename.replace('.lnk', '')
                target_path = ""
                
                try:
                    with open(lnk_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Parse TARGET_PATH from the file
                        for line in content.split('\n'):
                            if line.startswith('TARGET_PATH='):
                                target_path = line.split('=', 1)[1].strip()
                                break
                except Exception as e:
                    print(f"DEBUG api_get_workspace_tools_by_id: Fehler beim Lesen der .lnk-Datei {lnk_path}: {e}")
                    target_path = lnk_path  # Fallback to the lnk file path
                
                # Finde die echte Tool-ID basierend auf dem target_path
                tool_id = None
                if target_path:
                    # Suche das Tool in der Datenbank
                    for tool in tools:
                        if tool.get('path') == target_path:
                            tool_id = tool.get('id')
                            break
                
                if not tool_id:
                    # Fallback: generiere eine ID basierend auf dem Pfad
                    tool_id = hash(lnk_path) % 1000000
                
                # Erstelle ein Tool-Objekt für jede .lnk Datei
                workspace_tools.append({
                    "id": tool_id,  # Verwende die echte Tool-ID oder generierte ID
                    "name": tool_name,
                    "path": target_path if target_path else lnk_path,
                    "type": "workspace-tool"
                })
                print(f"DEBUG api_get_workspace_tools_by_id: Tool hinzugefügt: {tool_name} (ID: {tool_id})")

        print(f"DEBUG api_get_workspace_tools_by_id: Insgesamt {len(workspace_tools)} Tools gefunden")
        return jsonify(workspace_tools)
        
    except Exception as e:
        print(f"DEBUG api_get_workspace_tools_by_id: Fehler in api_get_workspace_tools_by_id: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/workspace-import', methods=['POST'])
def api_workspace_import():
    """Import a tool into a workspace by creating a .lnk inside the workspace folder."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Kein JSON im Request"}), 400

        workspace_id = data.get('workspace_id')
        tool_id = data.get('tool_id')
        print(f"DEBUG api_workspace_import: workspace_id={workspace_id}, tool_id={tool_id}")
        if not workspace_id or not tool_id:
            return jsonify({"error": "workspace_id und tool_id erforderlich"}), 400

        tools = load_json('tools')
        workspace = next((t for t in tools if t.get('id') == int(workspace_id) and t.get('type') == 'workspace'), None)
        if not workspace:
            return jsonify({"error": "Workspace nicht gefunden"}), 404

        tool = next((t for t in tools if t.get('id') == int(tool_id)), None)
        if not tool:
            return jsonify({"error": "Tool nicht gefunden"}), 404

        dest_folder = workspace.get('path')
        print(f"DEBUG api_workspace_import: dest_folder={dest_folder}")
        documents_workspace_prefix = os.path.join(os.path.expanduser('~'), 'Documents', 'HelpTool_Workspaces')
        needs_migration = (
            not dest_folder or
            os.path.normcase(dest_folder).startswith(os.path.normcase(documents_workspace_prefix))
        )

        if needs_migration:
            try:
                workspace_name = workspace.get('name', f"Workspace_{workspace_id}")
                safe_name = "".join(c for c in workspace_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                if not safe_name:
                    safe_name = f"Workspace_{workspace_id}"

                dest_folder = os.path.join(WORKSPACES_BASE_DIR, safe_name)
                os.makedirs(dest_folder, exist_ok=True)

                workspace['path'] = dest_folder
                for idx, existing_tool in enumerate(tools):
                    if existing_tool.get('id') == workspace['id']:
                        tools[idx]['path'] = dest_folder
                        break
                save_json('tools', tools)
                print(f"Workspace-Pfad nachträglich gesetzt: {dest_folder}")
            except Exception as path_error:
                print(f"Fehler beim Erstellen des Workspace-Pfads: {path_error}")
                return jsonify({"error": "Workspace-Pfad konnte nicht erstellt werden"}), 500

        print(f"DEBUG api_workspace_import: Erstelle Verknüpfung für Tool '{tool.get('name')}' in {dest_folder}")
        created = create_shortcut_at(tool.get('path'), tool.get('name', f"Tool_{tool_id}"), dest_folder)
        print(f"DEBUG api_workspace_import: create_shortcut_at returned: {created}")
        if created:
            print(f"DEBUG api_workspace_import: Verknüpfung erfolgreich erstellt: {created}")
            return jsonify({"success": True, "shortcut_path": created})
        else:
            print(f"DEBUG api_workspace_import: Verknüpfung konnte nicht erstellt werden")
            return jsonify({"error": "Verknüpfung konnte nicht erstellt werden"}), 500

    except Exception as e:
        print(f"Fehler in api_workspace_import: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/workspaces/import', methods=['POST'])
def api_workspace_import_alias():
    """Alias route used by legacy front-end code."""
    return api_workspace_import()

@app.route('/api/workspace/<int:workspace_id>/remove-category', methods=['POST'])
def api_workspace_remove_category(workspace_id):
    """Entfernt alle Tools einer bestimmten Kategorie aus einem Workspace."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Kein JSON im Request"}), 400

        category = data.get('category')
        if not category:
            return jsonify({"error": "category erforderlich"}), 400

        tools = load_json('tools')
        workspace = next((t for t in tools if t.get('id') == workspace_id and t.get('type') == 'workspace'), None)
        if not workspace:
            return jsonify({"error": "Workspace nicht gefunden"}), 404

        workspace_path = workspace.get('path')
        if not workspace_path or not os.path.exists(workspace_path):
            return jsonify({"error": "Workspace-Ordner nicht gefunden"}), 404

        # Helper function to determine tool type
        def get_tool_type(tool):
            path = tool.get('path', '')
            if tool.get('type'):
                return tool.get('type')
            if path.startswith(('http://', 'https://', 'ftp://')):
                return 'link'
            if path.startswith(('\\\\', '//')):
                return 'network'
            if path.lower().endswith(('.exe', '.bat', '.cmd')):
                return 'executable'
            return 'executable'

        removed_count = 0
        # Gehe durch alle .lnk Dateien im Workspace-Ordner
        for filename in os.listdir(workspace_path):
            if filename.endswith('.lnk'):
                lnk_path = os.path.join(workspace_path, filename)
                try:
                    # Lese die Tool-Informationen aus der .lnk Datei
                    with open(lnk_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        target_path = ""
                        for line in content.split('\n'):
                            if line.startswith('TARGET_PATH='):
                                target_path = line.split('=', 1)[1].strip()
                                break

                    if target_path:
                        # Finde das entsprechende Tool in der Datenbank
                        tool = next((t for t in tools if t.get('path') == target_path), None)
                        if tool and get_tool_type(tool) == category:
                            os.remove(lnk_path)
                            removed_count += 1
                            print(f"Entfernt: {filename} (Kategorie: {category})")
                except Exception as e:
                    print(f"Fehler beim Verarbeiten der Datei {filename}: {e}")

        return jsonify({"success": True, "message": f"{removed_count} Tools der Kategorie '{category}' entfernt"})

    except Exception as e:
        print(f"Fehler in api_workspace_remove_category: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/workspace/<int:workspace_id>/update', methods=['POST'])
def api_update_workspace(workspace_id):
    """Aktualisiert einen Workspace (Name, etc.)"""
    print(f"DEBUG api_update_workspace: called with workspace_id={workspace_id}")
    try:
        data = request.get_json()
        print(f"DEBUG api_update_workspace: data={data}")
        if not data:
            return jsonify({"error": "Kein JSON im Request"}), 400

        tools = load_json('tools')
        workspace = next((t for t in tools if t.get('id') == workspace_id and t.get('type') == 'workspace'), None)
        if not workspace:
            return jsonify({"error": "Workspace nicht gefunden"}), 404

        # Aktualisiere die erlaubten Felder
        if 'name' in data:
            workspace['name'] = data['name']
        if 'autostart' in data:
            workspace['autostart'] = data['autostart']

        save_json('tools', tools)
        return jsonify({"success": True, "workspace": workspace})

    except Exception as e:
        print(f"Fehler in api_update_workspace: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    try:
        # Bind to all interfaces so the container port mapping works
        app.run(host='0.0.0.0', port=5411)
    except Exception as e:
        print("Fehler beim Starten des Flask-Servers:")
        traceback.print_exc()
        try:
            input("Drücken Sie Enter zum Schließen...")
        except Exception:
            pass