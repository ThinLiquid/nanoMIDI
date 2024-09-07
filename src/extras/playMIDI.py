import math
import re
import keyboard
import mido
import time
from threading import Thread, Event
import sys
import os

floor = math.floor
press = keyboard.press
release = keyboard.release
velocityMap = "1234567890qwertyuiopasdfghjklzxc"
letterNoteMap = "1!2@34$5%6^78*9(0qQwWeErtTyYuiIoOpPasSdDfgGhHjJklLzZxcCvVbBnm"
LowNotes = "1234567890qwert"
HighNotes = "yuiopasdfghj"
sustainToggle = False
CloseThread = False
velocityList = [
    0, 4, 8, 12, 16, 20, 24, 28,
    32, 36, 40, 44, 48, 52, 56, 60,
    64, 68, 72, 76, 80, 84, 88, 92,
    96, 100, 104, 108, 112, 116, 120, 124
]
SavableSettings = {
    'sustainEnabled': False,
    'noDoubles': False,
    'velocity': False,
    '88Keys': True,
    'sustainCutoff': 63
}

pause_event = Event()
pause_event.clear()  # Start with the event set, meaning not paused

def find_velocity_key(velocity, velocityList, velocityMap):
    minimum = 0
    maximum = len(velocityList) - 1
    while minimum <= maximum:
        index = (minimum + maximum) // 2
        if index == 0 or index == len(velocityList) - 1:
            break
        if velocityList[index] < velocity:
            minimum = index + 1
        elif velocityList[index] > velocity:
            maximum = index - 1
    return velocityMap[index]

def simulate_key(type, note, velocity):
    global SavableSettings
    if not -15 <= note - 36 <= 88:
        return
    index = note - 36
    key = 0
    try:
        key = letterNoteMap[index]
    except:
        pass

    if type == "note_on":
        if SavableSettings["velocity"]:
            velocitykey = find_velocity_key(velocity)
            press("alt")
            press(velocitykey)
            release(velocitykey)
            release("alt")

        if 0 <= note - 36 <= 60:
            if SavableSettings["noDoubles"]:
                if re.search("[!@$%^*(]", key):
                    release(letterNoteMap[index - 1])
                else:
                    release(key.lower())
            if re.search("[!@$%^*(]", key):
                press("shift")
                press(letterNoteMap[index - 1])
                release("shift")
            elif key.isupper():
                press("shift")
                press(key.lower())
                release("shift")
            else:
                press(key)
        elif SavableSettings["88Keys"]:
            K = None
            if 20 <= note < 40:
                K = LowNotes[note - 21]
            else:
                K = HighNotes[note - 109]
            if K:
                release(K.lower())
                press("ctrl")
                press(K.lower())
                release("ctrl")
    elif 0 <= note - 36 <= 60:
        if re.search("[!@$%^*(]", key):
            release(letterNoteMap[index - 1])
        else:
            release(key.lower())
    else:
        if 20 <= note < 40:
            K = LowNotes[note - 21]
        else:
            K = HighNotes[note - 109]
        release(K.lower())

def parse_midi(message):
    global sustainToggle
    if message.type == "control_change" and SavableSettings["sustainEnabled"]:
        if not sustainToggle or message.value > SavableSettings["sustainCutoff"]:
            sustainToggle = True
            press("space")
        elif sustainToggle and message.value < SavableSettings["sustainCutoff"]:
            sustainToggle = False
            release("space")
    else:
        if message.type == "note_on" or message.type == "note_off":
            if message.velocity == 0:
                try:
                    simulate_key("note_off", message.note, message.velocity)
                except IndexError:
                    pass
            else:
                try:
                    simulate_key(message.type, message.note, message.velocity)
                except IndexError:
                    pass

playback_speed = 100
playback_finished = False

def midi_playback():
    global CloseThread, playback_speed, playback_finished
    try:
        mid = mido.MidiFile(f"{sys.argv[1]}/file.mid")
        start_time = time.time()
        for msg in mid:
            pause_event.wait()
            time.sleep(msg.time * (100 / playback_speed))
            parse_midi(msg)
            if CloseThread:
                break
            CloseThread = False
    except Exception as e:
        print(e)
    finally:
        playback_finished = True
        os._exit(0)

def input_listener():
    print('ready')
    global playback_speed
    while not playback_finished:
        option = input(">")
        if option == 'pp':
          if pause_event.is_set():
            pause_event.clear()
          else:
            pause_event.set()
        elif option == 'speed':
            playback_speed = min(500, playback_speed + 10)
        elif option == 'slow':
            playback_speed = max(10, playback_speed - 10)

if __name__ == "__main__":
    t = Thread(target=input_listener, daemon=True)
    t.start()
    try:
        midi_playback()
    finally:
        t.join()
