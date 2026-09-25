import test from 'node:test';import assert from 'node:assert/strict';import{supplierReadDenial}from'../src/lib/supplier-request-read-policy.ts';
for(const kind of ['list','record'])for(const status of [401,403])test(kind+' '+status+' retires the visible scope',()=>assert.equal(supplierReadDenial(status,kind),'all'));
test('list endpoint 404 is not an empty authorized inbox',()=>assert.equal(supplierReadDenial(404,'list'),'all'));
test('record 404 withdraws that record instead of other known authorized records',()=>assert.equal(supplierReadDenial(404,'record'),'record'));
for(const status of [0,200,400,408,409,429,500,502,503])test('unavailable status '+status+' does not invent revocation',()=>{for(const kind of ['list','record'])assert.equal(supplierReadDenial(status,kind),null);});
