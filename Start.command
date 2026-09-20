#!/bin/zsh
cd "${0:A:h}"
open http://localhost:8793
python3 serve.py
