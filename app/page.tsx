'use client';

import { useState, ChangeEvent, FormEvent } from 'react';

// 結果の型を定義
interface ScoreResult {
  score: number;
  colors: number[][];
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null); // ファイルを変えたら結果をリセット
      setError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('画像ファイルを選択してください。');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('解析に失敗しました。');
      }

      const data: ScoreResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50 text-gray-800">
      <div className="w-full max-w-2xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">ファッション色彩スコアリングAI</h1>
          <p className="text-lg text-gray-600 mt-2">画像の配色をAIが採点します</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
            コーディネート画像を選択
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {previewUrl && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <img src={previewUrl} alt="Preview" className="w-full h-auto object-cover" />
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isLoading}
            className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-300"
          >
            {isLoading ? '解析中...' : '採点する'}
          </button>
        </form>

        {error && <div className="mt-6 text-center text-red-600 bg-red-100 p-3 rounded-lg">{error}</div>}

        {result && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow-md animate-fade-in">
            
            <h2 className="text-2xl font-bold text-center mb-4">採点結果</h2>
            <div className="text-center mb-6">
              <p className="text-lg">色彩調和スコア</p>
              <p className="text-6xl font-extrabold text-blue-600">{result.score}<span className="text-3xl text-gray-500"> / 100</span></p>
            </div>
            
            <div>
              <p className="text-lg text-center font-semibold mb-3">抽出されたメインカラー</p>
              <div className="flex justify-center gap-4">
                {result.colors.map((color, index) => (
                  <div key={index} className="text-center">
                    <div
                      className="w-20 h-20 rounded-full shadow-inner border-2 border-white"
                      style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                    />
                    <p className="text-xs mt-2 text-gray-600">{`rgb(${color.join(', ')})`}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}