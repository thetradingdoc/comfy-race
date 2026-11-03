import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGpuUrl, validateOffer } from '../lib/comfy.mjs';

test('GPU origins come from server configuration and exclude credentials or alternate paths', () => {
  assert.equal(validateGpuUrl(''), '');
  assert.equal(validateGpuUrl('https://gpu.example:8889'), 'https://gpu.example:8889');
  for (const url of ['file:///tmp', 'https://a:b@gpu.example', 'https://gpu.example/path', 'https://gpu.example/?token=x']) assert.throws(() => validateGpuUrl(url));
});
test('live workflow contract excludes missing processing graphs and wrong frame dimensions', () => {
  const offer = { offer: { type: 'offer', sdp: 'v=0\r\n' }, resolution: { width: 512, height: 512 }, prompts: [{ 1: { class_type: 'LoadImage' }, 2: { class_type: 'PreviewImage' } }] };
  assert.deepEqual(validateOffer(offer), offer);
  assert.throws(() => validateOffer({ ...offer, prompts: [] }));
  assert.throws(() => validateOffer({ ...offer, prompts: [{ 1: { class_type: 'LoadImage' } }] }));
  assert.throws(() => validateOffer({ ...offer, resolution: { width: 1920, height: 1080 } }));
});
