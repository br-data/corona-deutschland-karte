#!/usr/bin/env node

"use strict"

const fs = require('fs');
const babelMinify = require('babel-minify');
const UglifyCSS = require('uglifycss');
const {resolve} = require('path');

const folderSrc = resolve(__dirname, '../docs');
const folderPub = resolve(__dirname, '../publish');

let style = [];
let script = [];

console.log('parse HTML');
let html = fs.readFileSync(resolve(folderSrc,'index.html'), 'utf8');

html = html.replace(/<!--.*?-->/g,'')

html = html.replace(/<script.*?<\/script>/g, match => {
	script.push(fs.readFileSync(resolve(folderSrc, match.match(/src="(.*?)"/)[1]), 'utf8'));
	return (script.length > 1) ? '' : '<script type="text/javascript" src="https://2ndwave.storage.googleapis.com/script.js"></script>';
})

html = html.replace(/<link.*?>/g, match => {
	if (!match.includes('rel="stylesheet"')) {
		return match.replace('href="', 'href="https://2ndwave.storage.googleapis.com/');
	}

	style.push(fs.readFileSync(resolve(folderSrc, match.match(/href="(.*?)"/)[1]), 'utf8'));
	return (style.length > 1) ? '' : '<link rel="stylesheet" type="text/css" href="https://2ndwave.storage.googleapis.com/style.css">';
})

html = html.replace(/\s+/g, ' ');

console.log('write HTML');
fs.writeFileSync(resolve(folderPub, 'index.html'), html, 'utf8');

console.log('write CSS');
style = UglifyCSS.processString(style.join('\n'));
fs.writeFileSync(resolve(folderPub, 'style.css'), style, 'utf8');

console.log('write JavaScript');
script = babelMinify(script.join('\n')).code;
fs.writeFileSync(resolve(folderPub, 'script.js'), script, 'utf8');

console.log('copy images');
fs.copyFileSync(resolve(folderSrc, 'icon.png'), resolve(folderPub, 'icon.png'));
fs.copyFileSync(resolve(folderSrc, 'card.png'), resolve(folderPub, 'card.png'));
