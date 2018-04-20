CHROME=1 npx webpack
cd dist/extension
zip -r ../chrome.zip *
cd ../../
npx webpack
cd dist/extension
zip -r ../firefox.zip *
