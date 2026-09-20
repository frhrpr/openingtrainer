# Source data

## caro-names.tsv

Caro-Kann variation names, extracted from
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings)
(CC0 / public domain).

Columns: `move path` (tab) `ECO` (tab) `name`.

The move path is the SAN sequence with move numbers stripped, e.g.
`e4 c6 d4 d5 Nc3` — this is what the trainer keys the lookup on, so no
FEN computation is needed at build time. Transpositions reached by a
different move order won't match; those still get named by the Lichess
explorer API at runtime.

Regenerate with:

    for f in a b c d e; do
      curl -sLO "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv"
    done
    grep -h $'\t.*Caro-Kann' [a-e].tsv | awk -F'\t' '{
      pgn=$3; gsub(/[0-9]+\.(\.\.)? ?/,"",pgn); gsub(/  +/," ",pgn);
      gsub(/^ +| +$/,"",pgn); printf "%s\t%s\t%s\n", pgn, $1, $2
    }' | sort > caro-names.tsv
