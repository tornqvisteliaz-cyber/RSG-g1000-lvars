# Tutorial: G1000 labels, Pilots Deck, and VATSIM

This is the practical version of the six ideas. Each section says what works in MSFS 2024, what to build, and where it stops.

## 1. Tune an advisory frequency on VATSIM

VATSIM voice follows the COM radio in the sim when vPilot is running and follow-COM is on. You do not need to inject a frequency into the G1000 screen. You set the radio the G1000 is already driving.

Use the Hz events. The old BCD16 events drop the third decimal, so 118.725 becomes 118.720.

```text
118725000 (>K:COM_STBY_RADIO_SET_HZ)
(>K:COM_STBY_RADIO_SWAP)
```

`118725000` is 118.725 MHz in Hz. COM2 is `COM2_STBY_RADIO_SET_HZ` and `COM2_STBY_RADIO_SWAP`.

Advisory means ATIS, AWOS, ASOS, or CTAF. The frequency itself comes from section 5. A Pilots Deck button, or a MobiFlight input, sends those two lines. The G1000 COM box will show the new active frequency, and vPilot will retune.

Do not send the frequency as a string LVar. The sim will not store it.

## 2. Improve the G1000 label add-on

The script in `html_ui/Pages/VCockpit/Instruments/G1000SoftkeyLVars/G1000SoftkeyLVars.js` reads the NXi softkey bar and writes numeric LVars.

Two fixes already in that file:

- Select only `.softkey-tab` inside `.softkeys-container`. The old selector also matched the label, value, and indicator inside each key.
- Do not take the last 12 DOM nodes. `querySelectorAll` is tree order. Sort the bottom row by `getBoundingClientRect().left`, so key 1 is the leftmost key.

Still worth having:

- Character LVars `C1` to `C8`, one ASCII code each. Packed `TXT0` is hard for Pilots Deck. See section 3.
- A debug LVar `L:G1000_SK_NODES` with how many keys were found. If it is 0, the script is not in the G1000 page.
- The real class for a grey key is `text-disabled`. A green bar is `indicating`. A dim bar is `indicating-dim`.

The script still only runs if the aircraft loads it. On a stock aircraft, `L:G1000_SK_BRIDGE_TICK` will not count. That is a sim limit, not a selector bug.

## 3. Encode the label so Pilots Deck can read it

Pilots Deck reads an LVar as a number, with unit Number. It cannot read `(L:name, String)`.

Use one LVar per character. For PFD softkey 2, label BACK:

| LVar | Value | Character |
| --- | --- | --- |
| `L:G1000_PFD_SK2_C1` | 66 | B |
| `L:G1000_PFD_SK2_C2` | 65 | A |
| `L:G1000_PFD_SK2_C3` | 67 | C |
| `L:G1000_PFD_SK2_C4` | 75 | K |
| `L:G1000_PFD_SK2_C5` | 0 | empty |

In the script, after the label is known:

```javascript
for (var c = 0; c < 8; c++) {
  setL(base + '_C' + (c + 1), c < label.length ? label.charCodeAt(c) : 0);
}
```

In Pilots Deck, add eight LVAR variables, `L:G1000_PFD_SK2_C1` through `C8`. A title gauge can map 66 to B, 65 to A, and so on. Eight letters covers STRMSCP, METAR, and IDENT.

The code LVar is easier for the button action. In Pilots Deck, read `L:G1000_PFD_SK2_CODE`. If it equals 12, the key is BACK. The press is still `H:AS1000_PFD_SOFTKEYS_2`.

Packed form, if you only have two LVars:

```text
char = (TXT div 128^n) mod 128
```

`TXT0` holds characters 0 to 3. `TXT1` holds 4 to 7. Space is 32. Pilots Deck has no built-in unpack, so prefer `C1` to `C8`.

Unknown labels stay at code 0. Bind those on `HASH`, which is stable for the same text.

## 4. Other glass cockpits

The same idea works on any HTML cockpit that will load a script. The names and the key count change.

| Cockpit | Keys | Press event | Label node |
| --- | --- | --- | --- |
| G1000 NXi | 12 softkeys | `H:AS1000_PFD_SOFTKEYS_1` | `.softkey-tab` |
| G3000 / G5000 | touch keys, count changes | GTC H events, per aircraft | GTC button labels |
| G3X Touch | softkeys plus touch | `H:AS3X_Touch_*` | its own key class |
| GNS 430 / 530 | fixed bezel, no changing softkey text | `H:AS430_*` | no label bridge needed |

Keep the LVar shape generic:

```text
L:RSG_<UNIT>_K<n>_CODE
L:RSG_<UNIT>_K<n>_C1
```

`UNIT` is `G1000_PFD`, `G3000_GTC1`, or `G3X_PFD`. Do not reuse `G1000_PFD_SK1` for a G3000 key.

G3000 is the awkward one. The GTC draws a variable number of buttons, not a fixed 12. Publish the count in `L:RSG_G3000_GTC1_N`, then `K1` onward. A Pilots Deck profile can only show as many keys as the Stream Deck has.

Each cockpit still has to load the script. A global plugin is ignored unless its `target` matches what that instrument accepts. G3X Touch expects `G3XTouchv2`. G1000 filtering is per aircraft. If tick stays 0, the instrument did not load the file.

## 5. A VATSIM frequency database

Use the public feed. It refreshes about every 15 seconds.

```text
GET https://data.vatsim.net/v3/vatsim-data.json
```

Useful fields:

- `controllers[]`: `callsign`, `frequency`, `facility`, `visual_range`
- `atis[]`: `callsign`, `frequency`, `text_atis`

Facility numbers used by the feed:

| Code | Station |
| --- | --- |
| 2 | Delivery |
| 3 | Ground |
| 4 | Tower |
| 5 | Approach / departure |
| 6 | Center |
| 7 | ATIS, when it is in `controllers` |

ATIS is also in the separate `atis` array. Callsign suffix tells the rest: `_ATIS`, `_DEL`, `_GND`, `_TWR`, `_APP`, `_DEP`, `_CTR`. A letter in the middle, as in `EGKK_A_ATIS` or `EDDF_N_APP`, is arrival/departure or a sector split, not a different service.

A local database is a JSON file of airport to advisory frequency, for CTAF and AWOS that are not online controllers. Example row:

```json
{ "icao": "ESSB", "kind": "CTAF", "mhz": "123.450" }
```

Match online first. If `atis` has `ESSB_ATIS`, tune that. If not, fall back to the local CTAF row.

The G1000 cannot fetch this. A small program on the PC polls the URL, filters by distance from the aircraft, and writes LVars through the MobiFlight WASM module or FSUIPC. Suggested outputs:

| LVar | Meaning |
| --- | --- |
| `L:RSG_ATC_N` | How many stations were in range |
| `L:RSG_ATC1_MHZ` | Frequency times 1000, so 118.725 is 118725 |
| `L:RSG_ATC1_FAC` | Facility code above |
| `L:RSG_ATC1_C1` to `C8` | Callsign, ASCII, same trick as section 3 |

Positions for distance are in `https://data.vatsim.net/v3/transceivers-data.json`. One controller can have several transceivers. Use the nearest transceiver to the aircraft, not the average, or you will tune a far sector.

## 6. Show who is online on the G1000

The feed can tell you who is online. The stock G1000 will not draw that list. There is no panel.xml to add a page, and the NXi will not load an extra view on a stock aircraft.

What you can show without drawing on the G1000:

- Pilots Deck or Stream Deck titles bound to `RSG_ATC1_C1` through `C8`, plus `RSG_ATC1_MHZ`.
- A MobiFlight display with the same LVars.
- A button that tunes `RSG_ATC1_MHZ` with the Hz event from section 1.

A real list on the G1000 screen needs an aircraft that loads a plugin, and a plugin that adds a menu item. That is an aircraft project, not a Community folder drop-in.

Nearest-station rule that is good enough for advisory:

1. Read aircraft latitude and longitude from `A:PLANE LATITUDE` and `A:PLANE LONGITUDE`.
2. Keep ATIS and tower whose nearest transceiver is inside `visual_range`, or inside 30 NM if range is missing.
3. Sort ATIS, then tower, then ground, then approach.
4. Write the first three into `ATC1`, `ATC2`, `ATC3`.
5. A tune button sends `RSG_ATC1_MHZ * 1000` to `COM_STBY_RADIO_SET_HZ`, then swap.

Poll every 20 seconds. The feed is cached for 15, and faster polling will get you blocked.

## Order to build it

1. Confirm `G1000_SK_BRIDGE_TICK` counts on an aircraft that loads the script.
2. Add `C1` to `C8` and read them in Pilots Deck.
3. Bind the 12 H events for presses.
4. Run the VATSIM poller outside the sim and write `RSG_ATC1_MHZ`.
5. Bind one button to the tune commands in section 1.

Steps 4 and 5 do not need the softkey script. They work on a stock aircraft today.
