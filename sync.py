import subprocess
from datetime import datetime

def run(cmd, ignore_error=False):
    """Ejecuta un comando en la terminal y devuelve el resultado."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0 and not ignore_error:
        print(f"\n[X] ERROR de Git:\n{result.stderr or result.stdout}")
        exit(1)
    return result.stdout.strip()

def main():
    print("\n[ ] Iniciando sincronizacion de Voice Assistant...")

    # 1. Verificar si hay cambios reales
    status = run("git status --porcelain")
    if not status:
        print("[OK] No hay cambios nuevos. Tu codigo ya esta seguro en la nube.\n")
        exit(0)

    # 2. Agregar todos los archivos permitidos
    print("[*] Empaquetando archivos nuevos...")
    run("git add .")

    # 3. Pedir mensaje (o generar uno automático)
    mensaje = input("[?] Que cambiaste? (Presiona ENTER para usar fecha automatica): ").strip()
    if not mensaje:
        fecha = datetime.now().strftime("%d/%m/%Y a las %H:%M")
        mensaje = f"Auto-Sync: Actualizacion del {fecha}"

    # 4. Sellar la caja
    print(f"[V] Guardando version: '{mensaje}'")
    run(f'git commit -m "{mensaje}"')

    # 5. Enviar a GitHub
    print("[>] Subiendo a GitHub... (esto puede tardar unos segundos)")
    run("git push origin main")

    print("[OK] Sincronizacion completada con exito!\n")

if __name__ == "__main__":
    main()