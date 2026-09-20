#!/bin/zsh
cd "${0:A:h}"
(sleep 1; open http://localhost:8793) &
python3 serve.py
