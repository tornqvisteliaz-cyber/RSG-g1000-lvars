# RSG G1000 LVars

Notes and a working sketch for reading Garmin G1000 NXi softkey labels in MSFS 2024, binding them in Pilots Deck, and using VATSIM's public data feed for advisory frequencies and online stations.

The page is at https://tornqvisteliaz-cyber.github.io/RSG-g1000-lvars/

The script is `html_ui/Pages/VCockpit/Instruments/G1000SoftkeyLVars/G1000SoftkeyLVars.js`.

The long walkthrough is `TUTORIAL.md`.

## What the sim actually gives you

MSFS LVars hold numbers only. Softkey text is not a simulator variable. Pilots Deck reads LVars as numbers. So a label has to be encoded.

This package publishes, for softkey 1 to 12 on PFD and MFD:

| LVar | Meaning |
| --- | --- |
| `L:G1000_PFD_SK2_CODE` | Dictionary code. `12` is BACK, `31` is CDI, `32` is OBS. `0` means empty or unknown. |
| `L:G1000_PFD_SK2_HASH` | FNV-1a of the label, for text missing from the table. |
| `L:G1000_PFD_SK2_EN` | `1` white, `0` grey or empty. |
| `L:G1000_PFD_SK2_IND` | `0` none, `1` dim bar, `2` selected. |
| `L:G1000_PFD_SK2_TXT0` | First 4 characters, 7-bit packed. |
| `L:G1000_PFD_SK2_TXT1` | Next 4 characters, 7-bit packed. |
| `L:G1000_PFD_SK2_C1` to `C8` | One ASCII code per character. This is the form Pilots Deck can show. |
| `L:G1000_SK_BRIDGE_TICK` | Counts while the script is running. |

Unit 1 is also published without the index (`G1000_PFD_SK2_CODE`). A second PFD uses `PFD2`.

Presses are already H events. Pilots Deck can send them as a CONTROL or as an RPN command if your bridge supports H events:

```text
(>H:AS1000_PFD_SOFTKEYS_2)
(>H:AS1000_MFD_SOFTKEYS_2)
```

## Limit on stock aircraft

A stock MSFS 2024 aircraft has no editable `panel.xml`. Dropping this folder in Community does not make the NXi load the script. `G1000_SK_BRIDGE_TICK` stays at 0 until the aircraft loads the JS. Addon aircraft with an open `panel.xml` can add:

```xml
<Plugin>coui://html_ui/Pages/VCockpit/Instruments/G1000SoftkeyLVars/G1000SoftkeyLVars.js</Plugin>
```

under `AS1000_PFD` and `AS1000_MFD`.

## VATSIM

VATSIM does not need a custom G1000 to tune a frequency. vPilot follows the sim COM radio. Set the standby frequency in Hz, then swap:

```text
118725000 (>K:COM_STBY_RADIO_SET_HZ)
(>K:COM_STBY_RADIO_SWAP)
```

Online stations come from `https://data.vatsim.net/v3/vatsim-data.json`. The sim cannot call that URL from a locked G1000. A small program outside the sim reads the feed and writes LVars. See the tutorial.

## Files

- `TUTORIAL.md` covers softkeys, Pilots Deck encoding, other glass cockpits, the VATSIM feed, advisory tune, and online stations.
- `docs/label-codes.csv` is the code table.
- `docs/index.html` is the short public page.
