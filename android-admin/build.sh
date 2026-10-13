#!/usr/bin/env bash
set -euo pipefail
app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
mode="${1:---unsigned}"
if [[ "$mode" != '--unsigned' && "$mode" != '--signed' ]]; then
  echo 'Usage: build.sh --unsigned|--signed' >&2; exit 2
fi
platform="$sdk_root/platforms/android-35/android.jar"
tool_root="$sdk_root/build-tools/35.0.0"
if [[ ! -f "$platform" || ! -x "$tool_root/aapt2" ]]; then
  echo 'Android SDK platform 35 and build-tools 35.0.0 are required.' >&2; exit 2
fi
if [[ "$mode" == '--signed' ]]; then
  : "${VELTSHOP_KEYSTORE:?Set the private signing keystore path}"
  : "${VELTSHOP_KEYSTORE_PASSWORD:?Set the signing password through the environment}"
fi
output="$app_root/build"
rm -rf -- "$output"
mkdir -p "$output/generated" "$output/classes" "$output/dex"
"$tool_root/aapt2" compile --dir "$app_root/res" -o "$output/resources.zip"
"$tool_root/aapt2" link -I "$platform" --manifest "$app_root/AndroidManifest.xml" \
  --java "$output/generated" --min-sdk-version 26 --target-sdk-version 35 \
  -o "$output/resources.apk" "$output/resources.zip"
mapfile -d '' sources < <(find "$app_root/src" "$output/generated" -name '*.java' -print0)
javac -encoding UTF-8 --release 8 -cp "$platform" -d "$output/classes" "${sources[@]}"
jar --create --file "$output/classes.jar" -C "$output/classes" .
"$tool_root/d8" --min-api 26 --lib "$platform" --output "$output/dex" "$output/classes.jar"
cp "$output/resources.apk" "$output/unsigned.apk"
python3 - "$output" <<'PY'
import pathlib, sys, zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(root/'unsigned.apk','a',compression=zipfile.ZIP_STORED) as archive:
    for dex in sorted((root/'dex').glob('*.dex')):
        archive.write(dex,dex.name)
PY
"$tool_root/zipalign" -f -p 4 "$output/unsigned.apk" "$output/aligned.apk"
if [[ "$mode" == '--signed' ]]; then
  apk="$output/Veltshop-Admin-1.0.0.apk"
  "$tool_root/apksigner" sign --ks "$VELTSHOP_KEYSTORE" --ks-key-alias veltshop-admin \
    --ks-pass env:VELTSHOP_KEYSTORE_PASSWORD --key-pass env:VELTSHOP_KEYSTORE_PASSWORD \
    --v4-signing-enabled false --out "$apk" "$output/aligned.apk"
  "$tool_root/apksigner" verify --verbose --print-certs "$apk"
else
  apk="$output/Veltshop-Admin-unsigned.apk"
  cp "$output/aligned.apk" "$apk"
fi
"$tool_root/zipalign" -c -p 4 "$apk"
echo "Built: $apk"
