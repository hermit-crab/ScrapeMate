CHROME=1 webpack
cd dist/extension
zip -r ../chrome.zip *
cd ../../
webpack
cd dist/extension
zip -r ../firefox.zip *
