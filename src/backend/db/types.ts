export interface DB {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, params?: any): Promise<any[]>;

}