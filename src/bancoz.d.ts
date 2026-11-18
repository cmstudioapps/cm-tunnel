declare module 'bancoz' {
  const bancoz: {
    criar: (tabela: string, id: string, dados: any) => Promise<any>;
    ler: (tabela: string, id: string) => Promise<any>;
    atualizar: (tabela: string, id: string, dados: any) => Promise<any>;
    deletar: (tabela: string, id: string) => Promise<any>;
    [key: string]: any;
  };
  export default bancoz;
}
