# kachikachi-patches

Pull the hidden "fix list" out of the NES/Famicom Classic Edition and turn it into a normal patch file you can use on a flash cart or an emulator.

## What this is

The game ROMs inside the console were not edited to fix typos. The fixes live in a list inside the emulator program, `kachikachi`. Each entry says "at this position in the ROM, write these bytes". When a game starts, the emulator applies the list on the fly.

That is why the Zelda ROM in the console still says "PENNINSULA" but the game on screen says "PENINSULA", and why the intro text shows the newer, rewritten version.

This tool reads that list and writes it out as an **IPS patch**, the usual format for "change these bytes in that ROM". You can then apply it to your own copy of the game.

## What you need

1. **Node.js** (version 14 or newer). Get it from [nodejs.org](https://nodejs.org). Check it works: open a terminal and type `node --version`.
2. **The emulator program from the console firmware.** The firmware is a file ending in `.hsqs`. It is a compressed disk image. Open it with **7-Zip** (the free program) and copy out one file: `usr/bin/kachikachi`. It is about 440 KB and has no extension.
3. **A clean copy of the game to patch** (the "base ROM"). This repository does not include any ROMs and does not tell you where to get one. Use your own dump.
   - For the NES Zelda, the base is the **USA, Rev 0** version, with the 16-byte iNES header (the file is 131088 bytes). The Zelda ROM inside the NES Classic firmware is the same game.
   - For the Famicom Zelda, the base is the **Famicom Disk System "Zelda no Densetsu", Rev 1**, as a `.qd` file (131072 bytes).
4. **This tool**: download `kpatch.js` from this repository into a folder.

## Step by step

Put these three files in one folder: `kpatch.js`, `kachikachi`, and your base ROM. Open a terminal in that folder.

### NES Zelda (the "peninsula" fix and the new intro)

```sh
node kpatch.js ips kachikachi "Legend of Zelda, The (USA).nes" zelda_fixed.ips --hdr 0x5db70-0x5f170
```

You should see: `45 records, 1873 bytes`. That means it found 45 fixes and wrote them to `zelda_fixed.ips`.

### Famicom Zelda (Disk System)

```sh
node kpatch.js ips kachikachi "Zelda no Densetsu - The Hyrule Fantasy (Japan) (Rev 1).qd" zelda_fds_fixed.ips --hdr 0x6b7e4-0x6d208
```

You should see: `62 records, 1745 bytes`.

### Use the patch

Open the `.ips` in an IPS patcher (for example Lunar IPS or Floating IPS), pick your base ROM, and apply. Always patch a **copy** and keep the original.

Or skip the patcher and let the tool do it directly:

```sh
node kpatch.js apply kachikachi "Legend of Zelda, The (USA).nes" zelda_fixed.nes --hdr 0x5db70-0x5f170
```

## Headered or unheadered? (a common mix-up)

Many NES ROMs start with a 16-byte "label" called the iNES header, which says which hardware the game needs. Some collections strip it off. A patch must match the ROM it is applied to:

- **ROM has the header** (131088 bytes for Zelda): use the commands above.
- **ROM has no header** (131072 bytes): add `--unheadered` to the `ips` command. That shifts every position back by 16 bytes.

If a patched game shows garbage, this is the first thing to check.

## What the options mean

| Option | What it does |
| --- | --- |
| `list` | Shows the fixes without writing anything. Handy for looking around. |
| `ips` | Writes an IPS patch file. |
| `apply` | Writes a patched copy of the ROM. |
| `--hdr LO-HI` | Only use the fixes found between these two positions in `kachikachi`. The list holds fixes for many games mixed together, so you choose the slice. |
| `--scan-from N` | Where to start looking inside `kachikachi` (default `0x58000`). |
| `--unheadered` | Write the patch for a ROM without the iNES header. |

The `list` command also prints how similar each fix is to the bytes already in your ROM at that spot. A fix for the right game is usually partly similar (it changes some letters and leaves the rest). A fix for a different game is close to 0%.

```sh
node kpatch.js list kachikachi "Legend of Zelda, The (USA).nes" --hdr 0x5db70-0x5f170
```

## Which slice is which

These are the slices I checked in **NES Classic firmware v1.0.7**. Other firmware versions may put things in other places, so the numbers can differ.

| Game | `--hdr` | Fixes | What changes |
| --- | --- | --- | --- |
| The Legend of Zelda (USA, Rev 0) | `0x5db70-0x5f170` | 45 | New intro text and the "peninsula" fix |
| Zelda no Densetsu (Disk System, Rev 1) | `0x6b7e4-0x6d208` | 62 | Same new intro text on the disk image |

The list also has fixes for other games (Metroid, Mega Man 2, Zelda II, Bubble Bobble, Super C, and more that I could not match to a game). They are not covered here yet.

## Good to know

- **How I picked the Zelda slice:** by where the Zelda fixes sit in the list, then I checked that the patched text reads correctly. The Disk System slice was matched to the disk by comparing bytes, not by anything the emulator says. I did not read the emulator's code to see how it decides which fixes apply to which game.
- **Order matters.** A few fixes overlap, so the tool writes and applies them in the same order as the list. That is my best guess at what the emulator does.
- **Not tested on real hardware.** I have not tried these patches on a flash cart or in an emulator. Treat it as a first version.
- **No ROMs, no firmware, no ready-made patches are in this repository.** You make everything from your own files.

## How it works (for the curious)

Each fix in the list is a small block:

| Part | Size | Meaning |
| --- | --- | --- |
| position | 4 bytes | where in the ROM to write (counting from the start of the file, header included) |
| length | 4 bytes | how many bytes to write |
| data | `length` bytes | the new bytes, stored 0x3C bytes **before** the position/length part |

Fixes are 64-byte aligned and separated by zeros, so the tool cuts the file at runs of zeros and checks that each piece looks like a real fix.

## Thanks

To [u/nmj79](https://www.reddit.com/user/nmj79), whose question in [r/RockinTheClassics](https://www.reddit.com/r/RockinTheClassics/comments/1xzydxa/how_did_the_nes_classic_edition_patch_the_legend/) about how the NES Classic Zelda gets its "peninsula" fix started all of this.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
