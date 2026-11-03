# ---- build: Rust -> wasm32 -> wasm-bindgen (no prebuilt artifacts trusted) ----
FROM docker.io/library/rust:1.99.1-slim-bookworm AS build
ARG WASM_BINDGEN_VERSION=0.2.112
RUN rustup target add wasm32-unknown-unknown \
 && cargo install --locked wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION}
WORKDIR /src
COPY Cargo.toml Cargo.lock build.rs ./
COPY src ./src
COPY ui ./ui
RUN cargo build --locked --release --lib --target wasm32-unknown-unknown \
 && wasm-bindgen --target web --out-dir /out/pkg --out-name vhpc26 --no-typescript \
      target/wasm32-unknown-unknown/release/vhpc26.wasm
COPY index.html loader.js loader.css /out/
COPY cfp/cfp.text /out/cfp/
# Content-hashed asset dir: JS glue + wasm + snippets of one build always travel
# together, so stale CDN/browser caches can never pair old JS with new wasm.
RUN H=$(cat /out/pkg/vhpc26.js /out/pkg/vhpc26_bg.wasm $(find /out/pkg/snippets -type f | sort) | sha256sum | cut -c1-16) \
 && mkdir /out/pkg.tmp && mv /out/pkg /out/pkg.tmp/$H && mkdir /out/pkg && mv /out/pkg.tmp/$H /out/pkg/ && rmdir /out/pkg.tmp \
 && L=$(cat /out/loader.js /out/loader.css | sha256sum | cut -c1-16) \
 && sed -i "s#__ASSET_HASH__#$H#" /out/loader.js \
 && sed -i "s#loader\.js\"#loader.js?v=$L\"#; s#loader\.css\"#loader.css?v=$L\"#" /out/index.html \
 && ! grep -q __ASSET_HASH__ /out/loader.js
RUN find /out -type f \( -name '*.js' -o -name '*.css' -o -name '*.wasm' -o -name '*.html' \) \
      -exec gzip -9 -k -n {} \;

# ---- runtime: unprivileged nginx, static files only ----
FROM docker.io/nginxinc/nginx-unprivileged:1.31.7-alpine
USER 0
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d \
 && apk upgrade --no-cache
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /out/ /usr/share/nginx/html/
# Root-owned, read-only content; OpenShift runs us as a random UID in group 0.
RUN chown -R root:root /usr/share/nginx/html /etc/nginx \
 && chmod -R a=rX /usr/share/nginx/html /etc/nginx
# Fail the build (not the rollout) on a bad config.
RUN nginx -t -c /etc/nginx/nginx.conf
USER 101
EXPOSE 8080
