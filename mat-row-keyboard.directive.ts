import {SelectionModel} from '@angular/cdk/collections';
import {AfterViewInit, Directive, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {MatTable, MatTableDataSource} from '@angular/material/table';

import { MatRowBase } from './mat-row-base';

const DEFAULT_OFFSET = 20;

/**
 * Diretiva para permitir navegação e marcação pelo teclado em um mat-row
 * Espaço ou enter selecionam / desselecionam uma linha
 * ArrowUp, ArrowDown, PgUp e PgDown fazem a navegação
 * Shift + teclas de navegação copiam a seleção da linha atual até a linha navegada
 *
 * Funciona com ou sem selection!
 * Funciona com ou sem paginator!
 * Funciona com ou sem sort!
 *
 * Modo de usar
 * ------------
 * 1) Adicione a classe matRowKeyboardDirective nas declarações do módulo em que está sendo utilizada
 *
 * 2) No elemento mat-row, adicione os atributos como no exemplo a seguir:
 *    matRowKeyboard
 *    [selection]="this.selection"
 *    [row]="row"
 *    [matTable]="matTable"
 *    tabindex=0 (onKeyboardSelection)="onSelecao()"
 *
 * 3) O MatTable, o DataSource e o Selection precisam ser de interfaces que extendem a interface MatRowBase
 * (que é uma interface fictícia criada com objetivo apenas de não utilizar o 'any' dentro da diretiva, eliminando
 *  assim erros do revisor automático do gitlab do CSJT)
 *
 * 4) Deverá possui uma interface ancestral para as interfaces utilizadas como item da mat-table.
 * O nome dessa interface ancestrar deve ser 'MatRowBase'.
 *
 * A opção 'selection' é opcional
 *
 * As opções 'row' e 'matTable' são obrigatórias
 *
 * A opção tabindex=0 é obrigatória para que o browser consiga dar o foco para o mat-row
 *
 * Obs.: Deve existir a variabel 'matTable' apontando para o mat-table (no .ts ou no .html com #matTable por exemplo)
 * Para mais detalhes veja explicações abaixo nas variáveis de @Input
 *
 * Exemplo:
 *     <table mat-table #matTable [dataSource]="dataSource" class="mat-elevation-z8">
 *     ...
 *       <tr mat-row *matRowDef="let item; let i = index; columns: colunasExibicao" matRowKeyboard
 *           (keydown)="onKeyDown($event, item)" [selection]="this.selection" [row]="item" [matTable]="matTable"
 *           tabindex=0 (onKeyboardSelection)="onAfterSelection()">
 *       </tr>
 *
 * Restrições
 * ----------
 * Para o cálculo do tamanho do page/up ou page down ser correto, entre o topo do container e o topo da tabela
 * não podem haver elementos e nem espaçamentos. No máximo um padding pequeno até 5 pixels.
 * Um mat-header-row com estilo 'position: sticky;' gerará um cálculo ainda mais correto.
 *
 * Autor: Rodrigo Luiz Beber
 * Data: 25/09/2022
 * email: rodrigobeber@trt9.jus.br
 */
@Directive({
  selector: '[matRowKeyboard]'
})
export class MatRowKeyboardDirective implements AfterViewInit {

  private selection: SelectionModel<MatRowBase> | undefined;

  // selection model que contém as seleções (opcional)
  @Input('selection') set MatRowKeyboardSelection(selection: SelectionModel<MatRowBase>) {
    this.selection = selection;
  }

  // caso nao deseja calcular o offset e queira um tamanho fixo para o page up / page down
  @Input() fixedOffset: number | undefined = undefined;

  // nome da TAG do container do mat-table, isto é, que contém o CSS com estilo overflow-y=scroll
  // serve apenas para calcular o tamanho do page/up e page/down
  // caso a opção 'fixedOffset' esteja preenchida, este parâmetro não será utilizado
  // obs.: não pode haver outro elemento com a mesma tag entre o elemento do view port e o mat-table
  @Input() containerTag = 'MAT-CARD-CONTENT';

  // elemento do array do datasource em que foi utilizada a tecla de navegação
  @Input() row: MatRowBase | undefined;

  // tabela que contém o datasource
  @Input() matTable: MatTable<MatRowBase> | undefined;

  // captura de evento quando a seleção é alterada
  // obs.: o evento (change) do SelectionModel dispara uma vez para cada linha, já
  // utilizando o evento abaixo, será um disparo por LOTE (quando utilizado shift + pgUp ou shift + pgDown)
  @Output() onKeyboardSelection = new EventEmitter<void>();

  constructor() {
  }

  ngAfterViewInit(): void {
    if (!this.matTable) {
      throw new Error('MatTable is required');
    }
    if (!this.matTable.dataSource) {
      throw new Error('[dataSource] is required');
    }
    if (!this.row) {
      throw new Error('[row] is required');
    }
  }

  private toogleSelection(row: MatRowBase | undefined): void {
    if (this.selection && row) {
      this.selection.toggle(row);
      this.onKeyboardSelection.emit();
    }
  }

  @HostListener('keydown', ['$event']) onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter': case ' ':
        event.preventDefault();
        setTimeout(() => this.toogleSelection(this.row), 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setTimeout(() => this.navigateToRow(1, event.shiftKey), 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setTimeout(() => this.navigateToRow(-1, event.shiftKey), 0);
        break;
      case 'PageDown':
        event.preventDefault();
        const offsetDown = this.getPageUpDownOffset(this.row);
        setTimeout(() => this.navigateToRow(offsetDown, event.shiftKey), 0);
        break;
      case 'PageUp':
        event.preventDefault();
        const offsetUp = this.getPageUpDownOffset(this.row);
        setTimeout(() => this.navigateToRow(offsetUp ? offsetUp * -1 : 0, event.shiftKey), 0);
        break;
      default:
    }
  }

  private getDataSource(): MatTableDataSource<MatRowBase> {
    return this.matTable?.dataSource as MatTableDataSource<MatRowBase>;
  }

  // trata teclas de navegação (up, down, page up, page down)
  private navigateToRow(offset: number | undefined, copySelection: boolean): void {

    if (offset === undefined || !this.row) {
        return;
    }

    // obtem linhas na mesma ordem em que aparecem na tela
    const ds = this.getDataSource();
    const rows = ds.sort ? ds.sortData(ds.data, ds.sort) : ds.data;

    // obtem indices absoluto e relativo da linha onde foi teclado
    const startIndexAbs = rows.findIndex(or => or === this.row);
    let startIndexRel = startIndexAbs;
    if (ds.paginator) {
      startIndexRel -= ds.paginator.pageIndex * ds.paginator.pageSize;
    }

    // obtem indices relativo e absoluto para onde esta navegando
    let targetIndexRel = this.getMatRowIndexInBound(startIndexRel + offset);
    let targetIndexAbs = startIndexAbs  + targetIndexRel - startIndexRel;

    // verifica se haverá mudança de página devido à navegação,
    // se sim, troca página e ajusta índices de destino
    if (ds.paginator) {
      // se nagevando para cima e está no último registro da página e tem mais registros pra frente
      if (offset > 0 && (startIndexRel + 1) % ds.paginator.pageSize === 0 && startIndexAbs + 2 <= ds.data.length) {
        ds.paginator.pageIndex = ds.paginator.pageIndex + 1;
        targetIndexRel = 0;
        targetIndexAbs = startIndexAbs + 1;
      } else
      // se nagevando para baixo e está no primeiro registro da página e tem mais registros pra trás
      if (offset < 0 && startIndexRel === 0 && startIndexAbs - 1 >= 0) {
        ds.paginator.pageIndex = ds.paginator.pageIndex - 1;
        targetIndexRel = ds.paginator.pageSize - 1;
        targetIndexAbs = startIndexAbs - 1;
      }
    }

    // se deseja copiar a selecao do checkbox de origem da navegação
    if (this.selection && copySelection) {
      // guarda a selecao da linha onde foi teclado
      const select = this.selection.isSelected(this.row);
      // preenche a seleção dentro do range
      this.setSelectionInRange(select, startIndexAbs, targetIndexAbs, rows);
      // emite evento avisando da alteração de seleção
      this.onKeyboardSelection.emit();
    }

    // obtem elemento para onde esta navegando e seta o foco
    const targetMatRowElement = this.getMatRowElementByIndex(targetIndexRel);
    if (targetMatRowElement) {
        targetMatRowElement.focus();
    }
  }

  private setSelectionInRange(select: boolean, indexA: number, indexB: number, rows: MatRowBase[]): void {
      // se navegando para baixo
      if (indexA < indexB) {
        // percorre linhas e marca com a mesma selecao da linha que foi teclado
        for (let i = indexA + 1; i <= indexB; i++) {
          select ? this.selection?.select(rows[i]) : this.selection?.deselect(rows[i]);
        }
      } else {
        // navegando para cima, percorre linhas e marca com a mesma selecao da linha que foi teclado
        for (let i = indexA - 1; i >= indexB; i--) {
          select ? this.selection?.select(rows[i]) : this.selection?.deselect(rows[i]);
        }
      }
  }

  // obtem indice mais próximo dentro dos limites existentes exibidos
  private getMatRowIndexInBound(index: number): number {
    const ds = this.getDataSource();
    let maxIndex = ds.data.length - 1;
    if (ds.paginator) {
      maxIndex = Math.min(ds.data.length - (ds.paginator.pageIndex * ds.paginator.pageSize), ds.paginator.pageSize) - 1;
    }
    return index < 0 ? 0 : index > maxIndex ? maxIndex : index;
  }

  // obtem o elemento HTML referente ao indice
  private getMatRowElementByIndex(index: number): HTMLElement | undefined {
    if (this.matTable) {
        const matRowsElements = this.matTable._getRenderedRows(this.matTable._rowOutlet);
        return matRowsElements[index];
    }
    return undefined;
  }

  // ------ TODO CODIGO DAQUI PARA BAIXO REFERE-SE AO CALCULO DO TAMANHO DO PAGEUP, PAGEDOWN

  // calcula tamanho do page/up, page/down dependendo das linhas visualizadas na tela
  private getPageUpDownOffset(row: MatRowBase | undefined): number | undefined {

    if (this.fixedOffset || !row) {
      return this.fixedOffset;
    }

    // offset padrão caso não encontre algum dos elementos HTML
    let offset = DEFAULT_OFFSET;

    // calcula altura de cada linha
    const matRowElement = this.getMatRowElement(row);
    if (!matRowElement) {
        return undefined;
    }
    const rowHeight = matRowElement.getBoundingClientRect().height;

    // obtem o elemento HTML do container (com overflow-y=scroll)
    const containerElement = this.getParentElementByTag(matRowElement, this.containerTag);
    // obtem o elemento HTML da tabela
    const tableElement = this.getParentElementByTag(matRowElement, 'TABLE');
    // obtem o elemento do HTML do <TR> (mat-header)
    if (!tableElement) {
        return undefined;
    }
    const trElement = tableElement.querySelector('TR');
    // se achou os elementos
    if (containerElement && tableElement && trElement) {
      // obtem os retangulos de cada um
      const containerRect = containerElement.getBoundingClientRect();
      const tableRect = tableElement.getBoundingClientRect();
      const trRect = trElement.getBoundingClientRect();
      // obtem o topo da primeira linha sendo visualizada na tela
      const top = containerRect.top + trRect.height;
      // obtem o bottom da ultima linha sendo visualizada na tela
      const bottom = Math.min(containerRect.bottom, tableRect.bottom);
      // calcula quantas linhas estao sendo exibidas na tela e diminui 1 pra chegar no tamanho do offset
      offset = Math.round((bottom - top) / rowHeight) - 1;
    }

    // retorna
    return offset;
  }

  // obtem o elemento HTML referente ao row (com ou sem offset)
  private getMatRowElement(row: MatRowBase, offset: number = 0): HTMLElement | undefined {
    const index = this.getMatRowElementIndex(row);
    const newIndex = offset !== 0 ? this.getMatRowIndexInBound(index + offset) : index;
    return this.getMatRowElementByIndex(newIndex);
  }

  // obtem o indice do elemento HTML referente ao row
  private getMatRowElementIndex(row: MatRowBase): number {
    const ds = this.getDataSource();
    const rows = ds.sort ? ds.sortData(ds.data, ds.sort) : ds.data;
    let index = rows.findIndex(or => or === row);
    if (ds.paginator) {
      index -= ds.paginator.pageIndex * ds.paginator.pageSize;
    }
    return index;
  }

  // obtem o elemento HTML do container da tabela
  private getParentElementByTag(el: HTMLElement, parentTag: string): HTMLElement | undefined {
    while (el && el.parentNode) {
      el = el.parentNode as HTMLElement;
      if (el.tagName.toUpperCase() === parentTag.toUpperCase()) {
        return el;
      }
    }
    return undefined;
  }

}
