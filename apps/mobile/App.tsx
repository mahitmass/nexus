import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

export default function App() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);

  const runScan = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, theme: 'mobile' }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) { alert("Connect to local IP address!"); }
  };

  return (
    <View style={{flex:1, backgroundColor:'#020617', justifyContent:'center', padding:24}}>
      <Text style={{color:'#22d3ee', fontSize:32, fontWeight:'bold', marginBottom:24, textAlign:'center'}}>NEXUS MOBILE</Text>
      <TextInput style={{backgroundColor:'#1e293b', color:'#f8fafc', padding:16, borderRadius:12, marginBottom:16}} placeholder="Scan input..." value={query} onChangeText={setQuery}/>
      <TouchableOpacity style={{backgroundColor:'#0891b2', padding:16, borderRadius:12}} onPress={runScan}>
        <Text style={{color:'white', fontWeight:'bold', textAlign:'center'}}>EXECUTE SCAN</Text>
      </TouchableOpacity>
      {result && <Text style={{color:'#94a3b8', marginTop:24, fontSize:18}}>{result.ai_insight}</Text>}
    </View>
  );
}