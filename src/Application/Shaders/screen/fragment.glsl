#ifdef GL_ES
precision mediump float;
#endif

const float PHI = 1.61803398874989484820459; // Φ = Golden Ratio
uniform float u_time;

// float gold_noise(vec2 xy, float seed) {
//   return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
// }

float noise(vec2 xy, float seed) {
  return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
}

void main() {
  // Monochrome film grain (soft-light blended in Renderer.ts), so it adds
  // texture without shifting the scene's colours.
  float n = noise(gl_FragCoord.xy, fract(u_time) + 1.0);
  gl_FragColor = vec4(vec3(n), 1.0);
}
