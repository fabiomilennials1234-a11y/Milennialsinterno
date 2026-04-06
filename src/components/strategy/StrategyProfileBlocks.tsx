import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserCircle, Star, FileImage, Globe, Info } from 'lucide-react';

interface BioData {
  is_good: boolean;
  line1?: string;
  line2?: string;
  line3?: string;
}

interface DestaqueItem {
  capa: string;
  conteudo: string;
}

interface DestaquesData {
  is_good: boolean;
  items?: DestaqueItem[];
}

interface PostItem {
  roteiro: string;
  legenda: string;
}

interface PostsData {
  is_good: boolean;
  items?: PostItem[];
}

interface LpSiteData {
  is_good: boolean;
  copy_text?: string;
}

interface Props {
  bio: BioData;
  setBio: (data: BioData) => void;
  destaques: DestaquesData;
  setDestaques: (data: DestaquesData) => void;
  posts: PostsData;
  setPosts: (data: PostsData) => void;
  lpSite: LpSiteData;
  setLpSite: (data: LpSiteData) => void;
}

const DEFAULT_DESTAQUES: DestaqueItem[] = [
  { capa: '', conteudo: '' },
  { capa: '', conteudo: '' },
  { capa: '', conteudo: '' },
];

const DEFAULT_POSTS: PostItem[] = [
  { roteiro: '', legenda: '' },
  { roteiro: '', legenda: '' },
  { roteiro: '', legenda: '' },
];

export default function StrategyProfileBlocks({ bio, setBio, destaques, setDestaques, posts, setPosts, lpSite, setLpSite }: Props) {
  const updateDestaqueItem = (index: number, field: keyof DestaqueItem, value: string) => {
    const items = [...(destaques.items || DEFAULT_DESTAQUES)];
    items[index] = { ...items[index], [field]: value };
    setDestaques({ ...destaques, items });
  };

  const updatePostItem = (index: number, field: keyof PostItem, value: string) => {
    const items = [...(posts.items || DEFAULT_POSTS)];
    items[index] = { ...items[index], [field]: value };
    setPosts({ ...posts, items });
  };

  return (
    <div className="space-y-6">
      {/* BIO */}
      <div className="p-5 bg-muted/30 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-foreground">BIO</h3>
        </div>

        <div>
          <Label className="text-sm font-medium">A bio do cliente é boa?</Label>
          <RadioGroup
            value={bio.is_good ? 'sim' : 'nao'}
            onValueChange={(v) => setBio({ ...bio, is_good: v === 'sim' })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="bio-sim" />
              <Label htmlFor="bio-sim" className="cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="bio-nao" />
              <Label htmlFor="bio-nao" className="cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
        </div>

        {!bio.is_good && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Adicione aqui a nova BIO:</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Linha 1 — O que você faz</Label>
                  <Input value={bio.line1 || ''} onChange={(e) => setBio({ ...bio, line1: e.target.value })} placeholder="Ex: Te ajudo a vender mais no B2B" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Linha 2 — Prova / Diferencial</Label>
                  <Input value={bio.line2 || ''} onChange={(e) => setBio({ ...bio, line2: e.target.value })} placeholder="Ex: +40 marcas atendidas • Método validado" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Linha 3 — Chamada para ação</Label>
                  <Input value={bio.line3 || ''} onChange={(e) => setBio({ ...bio, line3: e.target.value })} placeholder="Ex: 👇 Agende uma call de 15 min" />
                </div>
              </div>
            </div>
            <div className="p-3 bg-info/5 rounded-lg border border-info/20 text-xs space-y-2">
              <div className="flex items-center gap-1 text-info font-medium">
                <Info size={12} />
                Exemplos de BIO
              </div>
              <p><strong>Linha 1 — O QUE VOCÊ FAZ</strong><br />Te ajudo a vender mais no B2B / Transformo dentistas em referência na região / Aumento o faturamento de lojas físicas</p>
              <p><strong>Linha 2 — PROVA / DIFERENCIAL / AUTORIDADE</strong><br />+40 marcas atendidas • Equipe completa • Método validado / Especialista em prótese digital • 15 anos de experiência</p>
              <p><strong>Linha 3 — CHAMADA PARA AÇÃO</strong><br />👇 Agende uma call de 15 min para saber nossos valores.</p>
            </div>
          </div>
        )}
      </div>

      {/* Destaques */}
      <div className="p-5 bg-muted/30 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-foreground">Destaques</h3>
        </div>

        <div>
          <Label className="text-sm font-medium">O cliente possui bons destaques?</Label>
          <RadioGroup
            value={destaques.is_good ? 'sim' : 'nao'}
            onValueChange={(v) => setDestaques({ ...destaques, is_good: v === 'sim' })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="dest-sim" />
              <Label htmlFor="dest-sim" className="cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="dest-nao" />
              <Label htmlFor="dest-nao" className="cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
        </div>

        {!destaques.is_good && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-foreground">Adicione aqui os novos destaques:</p>
            {(destaques.items || DEFAULT_DESTAQUES).map((item, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 p-3 bg-card rounded-lg border border-border">
                <div>
                  <Label className="text-xs text-muted-foreground">Capa {i + 1}</Label>
                  <Input value={item.capa} onChange={(e) => updateDestaqueItem(i, 'capa', e.target.value)} placeholder="Título da capa" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conteúdo da capa {i + 1}</Label>
                  <Input value={item.conteudo} onChange={(e) => updateDestaqueItem(i, 'conteudo', e.target.value)} placeholder="Conteúdo" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="p-5 bg-muted/30 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <FileImage className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-foreground">Posts</h3>
        </div>

        <div>
          <Label className="text-sm font-medium">O cliente possui bons Posts?</Label>
          <RadioGroup
            value={posts.is_good ? 'sim' : 'nao'}
            onValueChange={(v) => setPosts({ ...posts, is_good: v === 'sim' })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="posts-sim" />
              <Label htmlFor="posts-sim" className="cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="posts-nao" />
              <Label htmlFor="posts-nao" className="cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
        </div>

        {!posts.is_good && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-foreground">Adicione os 3 posts fixados:</p>
            {(posts.items || DEFAULT_POSTS).map((item, i) => (
              <div key={i} className="space-y-2 p-3 bg-card rounded-lg border border-border">
                <Label className="text-xs font-medium text-muted-foreground">Post {i + 1}</Label>
                <div>
                  <Label className="text-xs text-muted-foreground">Roteiro</Label>
                  <Textarea value={item.roteiro} onChange={(e) => updatePostItem(i, 'roteiro', e.target.value)} placeholder="Roteiro do post..." rows={2} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Legenda</Label>
                  <Textarea value={item.legenda} onChange={(e) => updatePostItem(i, 'legenda', e.target.value)} placeholder="Legenda do post..." rows={2} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LP / Site */}
      <div className="p-5 bg-muted/30 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-foreground">LP / Site</h3>
        </div>

        <div>
          <Label className="text-sm font-medium">O cliente possui uma boa LP ou site?</Label>
          <RadioGroup
            value={lpSite.is_good ? 'sim' : 'nao'}
            onValueChange={(v) => setLpSite({ ...lpSite, is_good: v === 'sim' })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="lp-sim" />
              <Label htmlFor="lp-sim" className="cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="lp-nao" />
              <Label htmlFor="lp-nao" className="cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
        </div>

        {!lpSite.is_good && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Coloque aqui o documento com a copy da nova LP/Site:</p>
              <Textarea
                value={lpSite.copy_text || ''}
                onChange={(e) => setLpSite({ ...lpSite, copy_text: e.target.value })}
                placeholder="Copy da LP/Site ou link do documento..."
                rows={5}
              />
            </div>
            <div className="p-3 bg-info/5 rounded-lg border border-info/20 text-xs space-y-2">
              <div className="flex items-center gap-1 text-info font-medium">
                <Info size={12} />
                Modelo de referência
              </div>
              <p>Segue um link de modelo (+ Ideia de copy):</p>
              <a
                href="https://docs.google.com/document/d/1jVnfKXGPBFRdB3tUDXJNiKVufjbF9g2s4-a_lhT9-6M/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info underline break-all"
              >
                Abrir modelo no Google Docs
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
