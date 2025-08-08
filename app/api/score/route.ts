import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { kmeans } from 'ml-kmeans';
import { combinations } from 'mathjs';

// --- 色彩理論ヘルパー関数 ---

// RGBをHSVに変換 (H: 0-360, S: 0-100, V: 0-100)
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, v * 100];
}

// 色相スコア (0-100点)
function calculateHueScore(h1: number, h2: number): number {
  const diff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  if (diff <= 30) return 100; // 類似色：差diffが30°以下（隣の色）なら100点
  if (diff >= 150 && diff <= 210) return 90; // 補色：差が180°くらいなら90点
  return Math.max(0, 60 - diff); // それ以外なら、差が大きいほどスコアは低くなる
}

// 明度スコア (0-100点)
function calculateValueScore(v1: number, v2: number): number {
  return (Math.abs(v1 - v2) / 100) * 100; // 明度の差をそのままスコアにする
}

// 彩度スコア (0-100点)
function calculateSaturationScore(s1: number, s2: number): number {
  return 100 - (Math.abs(s1 - s2) / 100) * 100; // 100-彩度の差をそのままスコアにする
}


// --- メインのAPIハンドラ ---

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }

    // 1. 画像を読み込みピクセルデータを抽出
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100) // サイズを小さく100×100 pxlして処理を軽量化
      .raw() // 生のピクセルデータを取得
      .toBuffer({ resolveWithObject: true }); // コンピューターが扱いやすいようにBuffer形式に変換

    const pixels: number[][] = [];
    for (let i = 0; i < data.length; i += info.channels) {
      pixels.push([data[i], data[i + 1], data[i + 2]]); // [[R,G,B],...]という2次元配列に
    }

    // 2. k-meansで主要な3色を抽出 (RGB)　→　ここ自動で色数を決めたい！！！
    const k = 3; // 今回は主要の色を 3 に設定
    const result = kmeans(pixels, k, { seed: 42 }); // k-means法は最初にランダムな点を取るため、seed（種）を固定
    const dominantRgbs = result.centroids; // k-meansの結果から主要な色を取得

    // 3. 抽出した色をHSVに変換（上で定義した関数を使用）
    const dominantHsvs = dominantRgbs.map(rgb => rgbToHsv(rgb[0], rgb[1], rgb[2]));

    // 4. 全ての色のペアでスコアを計算
    const weights = { hue: 0.5, value: 0.3, saturation: 0.2 }; // 色相、明度、彩度の重み付け
    const colorIndices = Array.from({ length: k }, (_, i) => i);
      // 2つずつのペアを作成 （抽出した色の組み合わせ → 3C2 ってことだね。）
    const colorPairs: [number, number][] = []; // [R,G],[R,B],[G,B]のようなペアを作成
    for (let i = 0; i < colorIndices.length; i++) {
      for (let j = i + 1; j < colorIndices.length; j++) {
        colorPairs.push([colorIndices[i], colorIndices[j]]);
      }
    }
    
    if (colorPairs.length === 0) {
      return NextResponse.json({ score: 100, colors: dominantRgbs.map(c => c.map(Math.round)) });
    }

    // 各ペアのスコアを計算（colorPairs=[R,G][...][...]を1組ずつ計算していく）
    let totalScore = 0;
    colorPairs.forEach(pair => {
      const [h1, s1, v1] = dominantHsvs[pair[0]]; // 例）RのHSV
      const [h2, s2, v2] = dominantHsvs[pair[1]]; // 例）GのHSV
        // 色相、明度、彩度のスコアを計算
      const hueScore = calculateHueScore(h1, h2);
      const valueScore = calculateValueScore(v1, v2);
      const saturationScore = calculateSaturationScore(s1, s2);
        // 重み付けを考慮してペアのスコアを計算
      const pairScore = (hueScore * weights.hue) + (valueScore * weights.value) + (saturationScore * weights.saturation);
      totalScore += pairScore;
    });

    const finalScore = totalScore / colorPairs.length; // 平均スコアを計算（しっかり 3C2=3で割るイメージ）

    // 5. 結果を返す
    return NextResponse.json({
      score: Math.round(finalScore * 100) / 100,
      colors: dominantRgbs.map(c => c.map(Math.round)),
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process image.' }, { status: 500 });
  }
}