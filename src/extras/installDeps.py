import sys

libs = ['keyboard', 'mido']

def install(package):
    import subprocess
    subprocess.check_call(['python', "-m", "pip", "install", package])

try:
    import pip
except ImportError:
    print("pip not found. Attempting to install...")
    try:
        install("pip")
    except Exception as e:
        print("Failed to install pip.")

for lib in libs:
    try:
        __import__(lib)
    except ImportError:
        print(lib + " not found. Attempting to install...")
        try:
            install(lib)
        except Exception as e:
            print("Failed to install " + lib + ".")