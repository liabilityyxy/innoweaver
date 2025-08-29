cd /root
# wget https://github.com/meilisearch/meilisearch/releases/download/v1.19.1/meilisearch-linux-amd64 -O meilisearch-v1.19.1

mv ~/meilisearch ~/meilisearch-v1.11.1-backup

mv ~/meilisearch-v1.19.1 ~/meilisearch-binary
mkdir ~/meilisearch
mv ~/meilisearch-binary ~/meilisearch/meilisearch

chmod +x ~/meilisearch/meilisearch
rm -rf /root/meilisearch/data.ms
~/meilisearch/meilisearch --import-dump ~/meilisearch-v1.11.1-backup/dumps/20250829-055144726.dump --db-path /root/meilisearch/data.ms

sudo systemctl start meilisearch
sudo systemctl status meilisearch

curl http://localhost:7700/indexes
curl http://localhost:7700/indexes/paper_id/stats
curl http://localhost:7700/indexes/user_id/stats
curl http://localhost:7700/indexes/solution_id/stats
