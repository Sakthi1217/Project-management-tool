import { useEffect, useState } from 'react';
import { api } from '../services/api';
import Header from '../components/shared/Header';
import { Bot, Save, Zap, CheckCircle, XCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (recommended)' },
  { value: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
];

export default function AiConfigPage() {
  const [provider, setProvider] = useState<'azure_openai' | 'groq'>('azure_openai');
  const [enabled, setEnabled] = useState(false);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [temperature, setTemperature] = useState(0.7);

  // Azure fields
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [azureKeyMasked, setAzureKeyMasked] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');
  const [azureApiVersion, setAzureApiVersion] = useState('2024-02-01');
  const [showAzureKey, setShowAzureKey] = useState(false);

  // Groq fields
  const [groqKey, setGroqKey] = useState('');
  const [groqKeyMasked, setGroqKeyMasked] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [showGroqKey, setShowGroqKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.getAiConfig().then((data: any) => {
      setProvider(data.provider || 'azure_openai');
      setEnabled(data.enabled || false);
      setMaxTokens(data.max_tokens || 4000);
      setTemperature(parseFloat(data.temperature) || 0.7);

      setAzureEndpoint(data.azure_endpoint || '');
      setAzureKeyMasked(data.azure_api_key_masked || '');
      setAzureDeployment(data.azure_deployment || '');
      setAzureApiVersion(data.azure_api_version || '2024-02-01');

      setGroqKeyMasked(data.groq_api_key_masked || '');
      setGroqModel(data.groq_model || 'llama-3.3-70b-versatile');

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.updateAiConfig({
        provider, enabled, max_tokens: maxTokens, temperature,
        azure_endpoint: azureEndpoint, azure_api_key: azureKey,
        azure_deployment: azureDeployment, azure_api_version: azureApiVersion,
        groq_api_key: groqKey, groq_model: groqModel,
      });
      setAzureKeyMasked(result.azure_api_key_masked || '');
      setGroqKeyMasked(result.groq_api_key_masked || '');
      setAzureKey('');
      setGroqKey('');
      toast.success('Configuration saved');
      setTestResult(null);
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testAiConnection();
      setTestResult({ success: true, message: `Connection successful — Model: ${result.model}` });
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    }
    setTesting(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 dark:text-white";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div>
      <Header breadcrumbs={[{ label: 'AI Configuration' }]} />
      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Header Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8" />
            <h2 className="text-2xl font-bold">AI Integration</h2>
          </div>
          <p className="text-purple-100 text-sm">
            Connect with an AI provider to analyze projects, manage tasks, and assist in planning.
          </p>
        </div>

        {/* Enable + Provider */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Enable AI Assistant</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Activate integration across all projects</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${enabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Provider selector */}
          <div>
            <label className={labelClass}>Active Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Azure */}
              <button
                onClick={() => setProvider('azure_openai')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  provider === 'azure_openai'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="w-8 h-8 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                    <path d="M13.5 4.5L9 19.5L4.5 12l9-7.5z" fill="#0078D4" />
                    <path d="M13.5 4.5L19.5 12l-4.5 7.5H9L13.5 4.5z" fill="#50E6FF" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${provider === 'azure_openai' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>Azure OpenAI</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">GPT-4o, GPT-4o-mini</p>
                </div>
              </button>

              {/* Groq */}
              <button
                onClick={() => setProvider('groq')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  provider === 'groq'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="w-8 h-8 flex-shrink-0 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">G</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-semibold ${provider === 'groq' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-800 dark:text-gray-200'}`}>Groq Cloud</p>
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">Gratis</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Llama, Mixtral, DeepSeek</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Azure OpenAI config */}
        {provider === 'azure_openai' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Azure OpenAI Configuration
            </h3>

            <div>
              <label className={labelClass}>Endpoint</label>
              <input value={azureEndpoint} onChange={e => setAzureEndpoint(e.target.value)}
                placeholder="https://your-resource.openai.azure.com" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Azure resource URL (no trailing slash)</p>
            </div>

            <div>
              <label className={labelClass}>API Key</label>
              <div className="relative">
                <input type={showAzureKey ? 'text' : 'password'} value={azureKey}
                  onChange={e => setAzureKey(e.target.value)}
                  placeholder={azureKeyMasked || 'Enter your Azure API Key'}
                  className={inputClass + ' pr-10'} />
                <button onClick={() => setShowAzureKey(!showAzureKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  {showAzureKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {azureKeyMasked && !azureKey && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Key saved: {azureKeyMasked} — leave empty to keep it</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Deployment</label>
                <input value={azureDeployment} onChange={e => setAzureDeployment(e.target.value)}
                  placeholder="gpt-4o, gpt-4o-mini..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>API Version</label>
                <input value={azureApiVersion} onChange={e => setAzureApiVersion(e.target.value)}
                  placeholder="2024-02-01" className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Groq config */}
        {provider === 'groq' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                Groq Cloud Configuration
              </h3>
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                className="text-xs text-orange-500 hover:text-orange-600 underline">
                Get free API Key →
              </a>
            </div>

            <div>
              <label className={labelClass}>API Key</label>
              <div className="relative">
                <input type={showGroqKey ? 'text' : 'password'} value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder={groqKeyMasked || 'gsk_...'}
                  className={inputClass + ' pr-10'} />
                <button onClick={() => setShowGroqKey(!showGroqKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {groqKeyMasked && !groqKey && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Key saved: {groqKeyMasked} — leave empty to keep it</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Model</label>
              <div className="relative">
                <select value={groqModel} onChange={e => setGroqModel(e.target.value)}
                  className={inputClass + ' appearance-none pr-10'}>
                  {GROQ_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Llama 3.3 70B is the best balance of speed and quality</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-xs text-orange-700 dark:text-orange-300 font-medium mb-1">Groq free plan limits</p>
              <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-0.5">
                <li>• Llama 3.3 70B: 30 req/min, 14,400 req/day</li>
                <li>• No credit card required</li>
                <li>• Note: Groq does not support image analysis yet</li>
              </ul>
            </div>
          </div>
        )}

        {/* Advanced settings (shared) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Advanced Parameters</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Max Tokens</label>
              <input type="number" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 4000)}
                className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Maximum response length</p>
            </div>
            <div>
              <label className={labelClass}>Temperatura ({temperature.toFixed(1)})</label>
              <input type="range" min="0" max="1" step="0.1" value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full mt-2 accent-purple-500" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-4 rounded-xl text-sm border ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}>
            {testResult.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
            {testResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button onClick={handleTest} disabled={testing || !enabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors">
            <Zap className="w-4 h-4" /> {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {!enabled && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Enable AI to test the connection</p>
          )}
        </div>
      </div>
    </div>
  );
}
