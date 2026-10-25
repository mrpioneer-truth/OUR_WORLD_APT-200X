#!/bin/zsh
cd "${0:A:h}"
if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
fi
open -e .env
print 'OPENAI_API_KEY= 뒤에 본인 키를 넣고 저장하세요. 이후 시작.command를 다시 실행하면 연결됩니다.'
