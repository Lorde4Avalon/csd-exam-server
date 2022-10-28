#!/bin/sh
mkdir -p backup
cp data/data.db backup/data_$(date "+%Y%m%d_%H%M%S").db
