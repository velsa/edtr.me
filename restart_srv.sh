#restart uwsgi
#stop uwsgi-venv
#start uwsgi-venv

# Get directory this script is stored in (from stackoverflow)
DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Restarting nginx with config in ${DIR}/etc/nginx"
nginx -c ${DIR}/etc/nginx/nginx.conf -s reload

