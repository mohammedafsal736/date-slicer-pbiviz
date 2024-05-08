"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataViewCategorical = powerbi.DataViewCategorical;
import FilterAction = powerbi.FilterAction
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import * as d3 from "d3";

// import { VisualFormattingSettingsModel } from "./settings";
export class Visual implements IVisual {
    // private target: HTMLElement;
    private selectionManager: ISelectionManager;
    private selectionIds: any = {};
    private host: IVisualHost;
    private isEventUpdate: boolean = false;
    private startID: number;
    private endID: number;
    private tableName: string;
    private columnName: string;
    private idValuePair: any = [];
    private container: d3.Selection<HTMLElement, any, any, any>;
    private slicerContainer: d3.Selection<HTMLElement, any, any, any>;
    private dateSlicer1: d3.Selection<HTMLElement, any, any, any>;
    private dateSlicer2: d3.Selection<HTMLElement, any, any, any>;
    private filterableObject: any =[];
    private selectionIDLists: any =[];

    constructor(options: VisualConstructorOptions) {
        this.startID=0;
        this.endID=0;
        this.selectionIds = {};
        this.idValuePair = [];
        this.filterableObject=[];
        // this.target = options.element;
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        this.container = d3.select(options.element)
        .append('div')
        .classed('container', true)

        // Create slicer container
        this.slicerContainer = this.container
            .append('div')
            .classed('slicer-container', true);

        // Create date slicers
        this.dateSlicer2 = this.slicerContainer
            .classed('slicer-wrapper2', true)
            .append('input')
            .attr('type', 'date')
            .classed('date-slicer', true);

        this.dateSlicer1 = this.slicerContainer
            .classed('slicer-wrapper1', true)
            .append('input')
            .attr('type', 'date')
            .classed('date-slicer', true);

    }

    public update(options: VisualUpdateOptions) {
        if (options.type & powerbi.VisualUpdateType.Data && !this.isEventUpdate) {
            this.init(options);
        }
    }

    public init(options: VisualUpdateOptions) {
        const today: Date = new Date();
        const todayMinus7: Date = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); 
        if (!options ||
            !options.dataViews ||
            !options.dataViews[0] ||
            !options.dataViews[0].categorical ||
            !options.dataViews[0].categorical.categories ||
            !options.dataViews[0].categorical.categories[0]) {
            return;
        }
        const category = options.dataViews[0].categorical.categories[0];
        const values = category.values;
        // console.log(options)
        if (options.dataViews[0].categorical.categories) {
            for (const category of options.dataViews[0].categorical.categories) {
                this.tableName = category.source.queryName.split('.')[0];
                this.columnName = category.source.queryName.split('.')[1];
            }
        }
        values.forEach((item: number, index: number) => {
            this.selectionIds[item] = this.host.createSelectionIdBuilder()
                .withCategory(category, index)
                .createSelectionId();
    
            const value = item.toString();
            const idValue={}    
            
            idValue[this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']]= value;
            idValue["date"] = this.getDateString(new Date(item))
            if(this.getDateString(today) == this.getDateString(new Date(item))){
                this.startID = this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
            }else if(this.getDateString(todayMinus7) == this.getDateString(new Date(item)) ){
                this.endID = this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
            }
            this.idValuePair.push(idValue);
        });
        // console.log(this.idValuePair);
        this.dateSlicer1.property('value', this.getDateString(today));
        this.dateSlicer2.property('value', this.getDateString(todayMinus7));
        this.dateSlicer1.on('input', ()=> {
            this.isEventUpdate = true;
            this.selectionManager.clear();
            this.selectionIDLists.splice(0, this.selectionIDLists.length);
            const date1 = new Date(this.dateSlicer1.property('value'));
            const date2 = new Date(this.dateSlicer2.property('value'));
            let filterdata : any[]=[];
            // console.log(date1,date2)
            filterdata = this.applyDateFilter(date1,date2);
            applyFilter(filterdata,this.selectionIds,this.selectionManager,this.selectionIDLists);
            filterdata.splice(0, filterdata.length);
        })
        this.dateSlicer2.on('input', ()=> {
            this.isEventUpdate = true;
            this.selectionManager.clear();
            this.selectionIDLists.splice(0, this.selectionIDLists.length);
            const date1 = new Date(this.dateSlicer1.property('value'));
            const date2 = new Date(this.dateSlicer2.property('value'));
            let filterdata : any[]=[];
            filterdata = this.applyDateFilter(date1,date2);
            applyFilter(filterdata,this.selectionIds,this.selectionManager,this.selectionIDLists);
            filterdata.splice(0, filterdata.length);
        })

        applydefaultFilter(this.startID,this.endID,this.idValuePair,this.selectionManager,this.selectionIds);
        function applydefaultFilter(startid,endid,idvaluepair,selectionmanager,selectionid){
            selectionmanager.clear();
            const contiguousDates: Date[] = [];
            const filterable: string[] =[];
            for (let d = new Date(todayMinus7); d <= today; d.setDate(d.getDate() + 1)) {contiguousDates.push(new Date(d));}
            const calenderDate = contiguousDates.map(date => date.toISOString().slice(0,10));
            // console.log(calenderDate)
            idvaluepair.map((i:any)=>{
                calenderDate.map((j:any)=>{
                    if(i.date==j){
                        const key =Object.keys(i)[0]
                        filterable.push(i[key])
                    }
                })
            })
            // console.log(filterable)
            // const min = Math.min(startid, endid);
            // const max = Math.max(startid, endid);
            // const valueInRange: string[] =[];
            // for (let i = min; i <= max; i++) {
            //     valueInRange.push(idvaluepair[i][i]);
            // }
            // console.log(valueInRange)
            const selectionIDList : any[]=[];
            filterable.forEach(singlevalue => {selectionIDList.push(selectionid[singlevalue]);})
            selectionmanager.select(selectionIDList)
            selectionmanager.applySelectionFilter();
        }
        function applyFilter(filterdata,selectionid,selectionmanager,selectionIDLists){
            selectionmanager.clear()
            filterdata.forEach(singlevalue => {selectionIDLists.push(selectionid[singlevalue]);})
            selectionmanager.select(selectionIDLists)
            selectionmanager.applySelectionFilter();
        }
    }

    private getDateString(date: Date): string {
        const year: string = date.getFullYear().toString();
        const month: string = (date.getMonth() + 1).toString().padStart(2, '0');
        const day: string = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    private applyDateFilter(startDate: Date, endDate: Date ) {
        this.filterableObject.splice(0,this.filterableObject.length);
        const contiguousDates: Date[] = [];
        for (let d = new Date(endDate); d <= startDate; d.setDate(d.getDate() + 1)) {contiguousDates.push(new Date(d));}
        const calenderDate = contiguousDates.map(date => date.toISOString().slice(0,10));
        this.idValuePair.map((i:any)=>{
            calenderDate.map((j:any)=>{
                if(i.date==j){
                    const key =Object.keys(i)[0]
                    this.filterableObject.push(i[key])
                }
            })
        })
        // console.log(this.filterableObject)
        return this.filterableObject;
    }
    
}

// const select = document.createElement("select");
//         select.addEventListener('change', function(event) {
//             const selectedValue = (event.target as HTMLSelectElement).value;
//             this.isEventUpdate = true;
//             this.selectionManager.clear();
//             this.startID =this.selectionIds[selectedValue]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
//             applydefaultFilter(this.startID,this.endID,this.idValuePair,this.selectionManager,this.selectionIds);
//             // this.selectionManager.select(this.selectionIds[selectedValue])
//             // this.selectionManager.applySelectionFilter();
//         }.bind(this));
//         function formatDate(date: Date): string {
//             const year = date.getFullYear();
//             const month = (date.getMonth() + 1).toString().padStart(2, '0');
//             const day = date.getDate().toString().padStart(2, '0');
//             return `${year}-${month}-${day}`;
//         }
//         this.target.appendChild(select);
//         const select2 = document.createElement("select");
//         select2.addEventListener('change', function(event) {
//             const selectedValue = (event.target as HTMLSelectElement).value;
//             this.isEventUpdate = true;
//             this.selectionManager.clear();
//             this.endID =this.selectionIds[selectedValue]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
//             applydefaultFilter(this.startID,this.endID,this.idValuePair,this.selectionManager,this.selectionIds);
//         }.bind(this));

//         this.target.appendChild(select2);

        
// values.forEach((item: number, index: number) => {
//     this.selectionIds[item] = this.host.createSelectionIdBuilder()
//         .withCategory(category, index)
//         .createSelectionId();

//     const value = item.toString();
//     const datevalue= formatDate(new Date(value));
//     const idValue={}    
    
//     idValue[this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']]= value;
//     this.idValuePair.push(idValue);
//     const option = document.createElement("option");
//     option.value = value;
//     option.textContent = datevalue;
//     if (option.textContent === lastweekstring) {
//         this.startID = this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
//         option.selected = true; // Setting today's date as default
//     }
//     select.appendChild(option);
//     const option2 = document.createElement("option");
//     option2.value = value;
//     option2.textContent = datevalue;
//     if (option2.textContent === todaystring) {
//         this.endID = this.selectionIds[value]['dataMap'][`${this.tableName}.${this.columnName}`][0]['identityIndex']
//         option2.selected = true; // Setting today's date as default
//     }
//     select2.appendChild(option2);
// });

