// 代码已包含 CSS：使用 TailwindCSS , 安装 TailwindCSS 后方可看到布局样式效果
// 
// 临时解决方案：使用 ogv.js 支持更多视频格式（AVI/FMP4等）
// 在 HTML 的 <head> 中添加以下内容:
// <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
// <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/ogv@1.9.0/dist/ogv.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/videojs-ogvjs@2.0.0/dist/videojs-ogvjs.min.js"></script>

import React, { useState, useRef, useEffect, useCallback } from 'react';

// API 基础地址
const API_BASE_URL = 'http://localhost:8000';

// 声明全局 videojs 和 OGVCompat
declare global {
  interface Window {
    videojs: any;
    OGVCompat: any;
    OGVLoader: any;
  }
}

// 检测视频格式
const getVideoType = (url: string): string => {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0].split('#')[0] || '';
  const typeMap: Record<string, string> = {
    'mp4': 'video/mp4',
    'm4v': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'ogv': 'video/ogg',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm3u8': 'application/x-mpegURL',
  };
  return typeMap[ext] || 'video/mp4';
};

// 定义结果类型
interface SearchResult {
  id: number | string;
  type: string;
  text?: string;
  image_path?: string;
  reference_image_path?: string;
  image_url?: string;
  reference_image_url?: string;
  video_id?: string;
  video_path?: string;
  video_url?: string;
  start_time?: number;
  end_time?: number;
  similarity: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [textInput, setTextInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewId, setVideoPreviewId] = useState<string | null>(null);
  const [videoStartTime, setVideoStartTime] = useState<number | null>(null);
  const [videoEndTime, setVideoEndTime] = useState<number | null>(null);
  
  const [textResults, setTextResults] = useState<SearchResult[]>([]);
  const [imageResults, setImageResults] = useState<SearchResult[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Video.js 相关
  const playerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  // 视频播放错误处理
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 文本检索
  const handleTextSearch = async () => {
    if (!textInput.trim()) {
      setError('请输入查询文本');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('query', textInput);
      formData.append('limit', '6');

      const response = await fetch(`${API_BASE_URL}/search_by_text`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '请求失败');
      }

      const data = await response.json();
      if (data.success && data.results) {
        setTextResults(data.results);
      } else {
        throw new Error('返回数据格式错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '文本检索失败');
      console.error('文本检索错误:', err);
    } finally {
      setLoading(false);
    }
  };

  // 图片检索
  const handleImageSearch = async () => {
    if (!uploadedFile) {
      setError('请上传图片');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('limit', '6');

      const response = await fetch(`${API_BASE_URL}/search_by_image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '请求失败');
      }

      const data = await response.json();
      if (data.success && data.results) {
        setImageResults(data.results);
      } else {
        throw new Error('返回数据格式错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片检索失败');
      console.error('图片检索错误:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (activeTab === 'text') {
      handleTextSearch();
    } else {
      handleImageSearch();
    }
  };

  // 获取图片URL
  const getResultImageUrl = (result: SearchResult): string => {
    if (result.image_url) return result.image_url;
    if (result.reference_image_url) return result.reference_image_url;
    return 'https://via.placeholder.com/400x300?text=No+Image';
  };

  // 简化的标题显示 - 提取行人编号
  const getDisplayTitle = (result: SearchResult): string => {
    const path = result.image_path || result.reference_image_path;
    if (path) {
      const filename = path.split(/[/\\]/).pop() || '';
      const match = filename.match(/track_(\d+)/);
      if (match) {
        return `行人 #${parseInt(match[1], 10)}`;
      }
      return filename.replace(/_fullbody\.jpg$/i, '').slice(-25);
    }
    return `结果 ${result.id}`;
  };

  // 简化视频来源显示
  const getShortVideoSource = (videoId?: string): string => {
    if (!videoId) return '未知来源';
    if (videoId.length > 20) {
      if (videoId.includes('_frames')) {
        const base = videoId.replace('_frames', '');
        if (base.length > 18) {
          return base.slice(0, 8) + '...' + base.slice(-8);
        }
        return base;
      }
      return videoId.slice(0, 8) + '...' + videoId.slice(-8);
    }
    return videoId;
  };

  // 格式化时间显示
  const formatTime = (seconds?: number): string => {
    if (seconds === undefined || seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取当前结果（显示6张）
  const getCurrentResults = (): SearchResult[] => {
    const results = activeTab === 'text' ? textResults : imageResults;
    return results.slice(0, 6);
  };

  // 相似度颜色
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 85) return 'bg-green-500';
    if (similarity >= 75) return 'bg-blue-500';
    if (similarity >= 65) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  // 排名颜色
  const getRankColor = (index: number): string => {
    if (index === 0) return 'bg-yellow-400';
    if (index === 1) return 'bg-gray-400';
    if (index === 2) return 'bg-amber-600';
    return 'bg-blue-400';
  };

  // 打开视频 - 使用 Video.js with OGV.js fallback
  const handleOpenVideo = (item: SearchResult) => {
    let url = item.video_url || item.video_path;
    if (url) {
      url = url.replace(/\\/g, '/');
      if (!url.startsWith('http') && !url.startsWith('//')) {
        const cleanPath = url.startsWith('/') ? url.slice(1) : url;
        url = `${API_BASE_URL}/${cleanPath}`;
      }

      // 移除 URL 中的 hash 片段（#t=start,end），我们会手动处理时间跳转
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        url = url.substring(0, hashIndex);
      }

      setVideoError(null);
      setIsVideoLoading(true);
      setVideoPreviewUrl(url);
      setVideoPreviewId(item.video_id || '来源视频');
      setVideoStartTime(item.start_time ?? null);
      setVideoEndTime(item.end_time ?? null);
    } else {
      alert('未找到视频路径');
    }
  };

  // 关闭视频
  const handleCloseVideo = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.dispose();
      } catch (e) {
        console.warn('Error disposing player:', e);
      }
      playerRef.current = null;
    }
    setVideoPreviewUrl(null);
    setVideoPreviewId(null);
    setVideoStartTime(null);
    setVideoEndTime(null);
    setVideoError(null);
    setIsVideoLoading(false);
  }, []);

  // 初始化 Video.js 播放器 (支持 OGV.js 回退)
  useEffect(() => {
    if (!videoPreviewUrl || !videoContainerRef.current) return;

    // 等待 videojs 加载完成
    const initPlayer = () => {
      // 检查 videojs 是否已加载
      if (typeof window.videojs === 'undefined') {
        console.error('Video.js not loaded. Please include video.js script in HTML.');
        setVideoError('播放器库未加载，请刷新页面重试');
        setIsVideoLoading(false);
        return;
      }

      // 清理之前的播放器
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing previous player:', e);
        }
        playerRef.current = null;
      }

      // 创建新的 video 元素
      const container = videoContainerRef.current;
      if (!container) return;
      
      container.innerHTML = '';
      const videoEl = document.createElement('video');
      videoEl.id = 'video-player-' + Date.now();
      videoEl.className = 'video-js vjs-big-play-centered vjs-fluid';
      videoEl.setAttribute('playsinline', 'true');
      videoEl.style.width = '100%';
      videoEl.style.height = '65vh';
      container.appendChild(videoEl);

      const videoType = getVideoType(videoPreviewUrl);
      const isNativeSupported = ['video/mp4', 'video/webm', 'video/ogg'].includes(videoType);

      // 配置选项
      const playerOptions: any = {
        controls: true,
        autoplay: true,
        preload: 'auto',
        fluid: true,
        responsive: true,
        playbackRates: [0.5, 1, 1.5, 2],
        sources: [{
          src: videoPreviewUrl,
          type: videoType
        }],
        html5: {
          vhs: {
            overrideNative: true,
            enableLowInitialPlaylist: true,
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
          nativeTextTracks: false
        }
      };

      // 如果是非原生支持的格式，尝试使用 OGV.js 技术栈
      if (!isNativeSupported && window.OGVCompat) {
        console.log('Using OGV.js for format:', videoType);
        playerOptions.techOrder = ['ogvjs', 'html5'];
        playerOptions.ogvjs = {
          base: 'https://cdn.jsdelivr.net/npm/ogv@1.9.0/dist/'
        };
      }

      try {
        const player = window.videojs(videoEl, playerOptions);
        playerRef.current = player;

        // 播放器就绪事件
        player.ready(() => {
          setIsVideoLoading(false);
          console.log('Player ready, seeking to:', videoStartTime);
          
          // 跳转到指定时间
          if (videoStartTime !== null && videoStartTime > 0) {
            player.currentTime(videoStartTime);
          }
        });

        // 可以播放事件
        player.on('canplay', () => {
          setIsVideoLoading(false);
        });

        // 监听时间更新，自动暂停在结束时间
        if (videoEndTime !== null) {
          player.on('timeupdate', () => {
            const currentTime = player.currentTime();
            if (currentTime && videoEndTime && currentTime >= videoEndTime) {
              player.pause();
            }
          });
        }

        // 错误处理 - 尝试备选方案
        player.on('error', () => {
          const error = player.error();
          console.error('Video.js error:', error);
          
          // 如果是原生格式失败，可能是编码问题
          if (isNativeSupported) {
            setVideoError(
              `视频播放失败: ${error?.message || '格式不支持'}\n` +
              '该视频可能使用了浏览器不支持的编码格式（如 MJPEG）。\n' +
              '建议：将视频转码为 H.264 编码的 MP4 格式。'
            );
          } else {
            setVideoError(
              `视频格式 (${videoType}) 不受浏览器原生支持。\n` +
              '建议：将视频转码为 MP4 (H.264) 或 WebM (VP9) 格式。\n' +
              `原始错误: ${error?.message || '未知错误'}`
            );
          }
          setIsVideoLoading(false);
        });

      } catch (err) {
        console.error('Error initializing player:', err);
        setVideoError(`播放器初始化失败: ${err instanceof Error ? err.message : '未知错误'}`);
        setIsVideoLoading(false);
      }
    };

    // 短暂延迟以确保 DOM 已更新
    const timer = setTimeout(initPlayer, 100);

    // 清理函数
    return () => {
      clearTimeout(timer);
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing player on cleanup:', e);
        }
        playerRef.current = null;
      }
    };
  }, [videoPreviewUrl, videoStartTime, videoEndTime]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">多模态检索系统</h1>
        <button className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors">
          <i className="fas fa-sign-out-alt mr-2"></i>退出系统
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 py-6 max-w-7xl mx-auto w-full">
        {/* Search Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'text' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('text')}
            >
              <i className="fas fa-align-left mr-2"></i>文本检索
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'image' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('image')}
            >
              <i className="fas fa-image mr-2"></i>图片检索
            </button>
          </div>

          {/* Search Forms */}
          <div className="p-6">
            {activeTab === 'text' ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">输入查询文本</label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="例如：穿着蓝色上衣的中年女性"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
                <div className="flex justify-center">
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    onClick={handleSearch}
                    disabled={loading || !textInput.trim()}
                  >
                    {loading ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>检索中...</>
                    ) : (
                      <><i className="fas fa-search mr-2"></i>文本检索</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">上传查询图片</label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                  ) : (
                    <div className="py-4">
                      <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                      <p className="text-gray-500">点击或拖拽图片到此处上传</p>
                      <p className="text-sm text-gray-400 mt-1">支持 JPG, PNG 格式</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <div className="flex justify-center">
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    onClick={handleSearch}
                    disabled={loading || !imagePreview}
                  >
                    {loading ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>检索中...</>
                    ) : (
                      <><i className="fas fa-search mr-2"></i>图片检索</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-1">📊 展示规则</div>
            <div>显示相似度最高的 6 张图片，方便快速核查。</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-1">🎬 溯源提示</div>
            <div>点击"播放视频"可跳转到来源视频对应时间段。</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-1">💡 质量建议</div>
            <div>上传清晰图片或输入详细特征描述，提升命中率。</div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </div>
        )}

        {/* Results Section */}
        {getCurrentResults().length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              检索结果 
              <span className="text-sm font-normal text-gray-500 ml-2">
                (共 {getCurrentResults().length} 个匹配)
              </span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCurrentResults().map((item, index) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="relative">
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shadow ${getRankColor(index)}`}>
                        {index + 1}
                      </span>
                    </div>
                    
                    <div className="absolute top-2 right-2 z-10">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white shadow ${getSimilarityColor(item.similarity)}`}>
                        {item.similarity.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                      <img 
                        src={getResultImageUrl(item)} 
                        alt={getDisplayTitle(item)} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-800 mb-2 truncate" title={getDisplayTitle(item)}>
                      {getDisplayTitle(item)}
                    </h3>
                    
                    <div className="text-xs text-gray-500 mb-2 space-y-1">
                      <div className="flex items-center gap-1.5" title={item.video_id}>
                        <i className="fas fa-film text-gray-400"></i>
                        <span className="truncate">{getShortVideoSource(item.video_id)}</span>
                      </div>
                      {item.start_time !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <i className="fas fa-clock text-gray-400"></i>
                          <span>
                            {formatTime(item.start_time)}
                            {item.end_time !== undefined && ` - ${formatTime(item.end_time)}`}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 rounded-lg transition-colors font-medium"
                      onClick={() => handleOpenVideo(item)}
                    >
                      <i className="fas fa-play mr-1.5"></i>播放视频
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Video.js Preview Modal with OGV.js fallback */}
      {videoPreviewUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="text-sm text-gray-700 flex items-center gap-2">
                <i className="fas fa-video text-emerald-600"></i>
                <span className="font-medium truncate max-w-md" title={videoPreviewId || ''}>
                  {videoPreviewId}
                </span>
                {videoStartTime !== null && (
                  <span className="text-gray-400 ml-2">
                    ({formatTime(videoStartTime)}
                    {videoEndTime !== null && ` - ${formatTime(videoEndTime)}`})
                  </span>
                )}
              </div>
              <button
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-200 rounded-full transition-colors"
                onClick={handleCloseVideo}
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            {/* 视频播放区域 */}
            <div className="bg-black relative">
              {/* 加载指示器 */}
              {isVideoLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-white text-center">
                    <i className="fas fa-spinner fa-spin text-4xl mb-2"></i>
                    <p>加载中...</p>
                  </div>
                </div>
              )}
              
              {/* 错误显示 */}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                  <div className="text-white text-center p-6 max-w-lg">
                    <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p className="whitespace-pre-line text-sm mb-4">{videoError}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                        onClick={() => {
                          // 尝试用原生 video 元素直接播放
                          window.open(videoPreviewUrl, '_blank');
                        }}
                      >
                        <i className="fas fa-external-link-alt mr-2"></i>
                        在新窗口打开
                      </button>
                      <button
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                        onClick={handleCloseVideo}
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Video.js 播放器容器 */}
              <div 
                ref={videoContainerRef}
                data-vjs-player
                style={{ width: '100%', minHeight: '65vh' }}
              />
            </div>
            
            {/* 视频格式提示 */}
            <div className="px-4 py-2 bg-gray-100 border-t text-xs text-gray-500 flex items-center justify-between">
              <span>
                <i className="fas fa-info-circle mr-1"></i>
                支持格式: MP4 (H.264), WebM, OGG | 其他格式可能需要转码
              </span>
              <a
                href={videoPreviewUrl}
                download
                className="text-blue-600 hover:text-blue-800"
              >
                <i className="fas fa-download mr-1"></i>
                下载原视频
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 px-6">
        <div className="flex justify-between items-center text-sm text-gray-500 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <span><i className="fas fa-circle text-green-500 mr-1.5"></i>CLIP 模型已连接</span>
            <span><i className="fas fa-circle text-green-500 mr-1.5"></i>LanceDB 正常</span>
          </div>
          <span>多模态检索系统 v1.0.0 (Video.js)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
